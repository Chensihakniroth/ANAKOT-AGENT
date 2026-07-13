"""HTTP routes for the dashboard-auth OAuth round trip.

Mounted at root (no prefix) by ``web_server.py``. The router does not
auto-gate; gating is performed by ``gated_auth_middleware``, which
allowlists everything under ``/auth/*`` and ``/api/auth/providers``.

The routes:

  GET  /auth/login?provider=N → 302 to IDP, sets PKCE cookie
  GET  /auth/callback?code,state → completes login, sets session cookies
  POST /auth/logout        → clears cookies, best-effort revoke
  GET  /api/auth/providers → list registered providers (login bootstrap)
  GET  /api/auth/me        → current Session as JSON (auth-required)
  GET  /api/auth/profile-for-user  → profile name for current user (auth-required)
  POST /api/auth/onboard    → create profile on first login (auth-required)
"""

from __future__ import annotations

import asyncio
import logging
import re
import threading
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Tuple

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

# Imported at module level (not deferred) so cold-import cost is paid at
# server startup, not on the first onboard request.  create_profile is
# called via run_in_executor to avoid blocking the ASGI event loop.
from anakot_cli.profiles import create_profile

from anakot_cli.dashboard_auth import (
    get_provider,
    list_providers,
)
from anakot_cli.dashboard_auth.user_metadata import (
    is_admin as _is_admin_user,
    list_all_users as _list_all_users_meta,
    set_user_role as _set_user_role_meta,
)
from anakot_cli.dashboard_auth.audit import AuditEvent, audit_log
from anakot_cli.dashboard_auth.base import (
    InvalidCodeError,
    InvalidCredentialsError,
    ProviderError,
)
from anakot_cli.dashboard_auth.cookies import (
    clear_pkce_cookie,
    clear_session_cookies,
    detect_https,
    read_pkce_cookie,
    read_session_cookies,
    set_pkce_cookie,
    set_session_cookies,
)

_log = logging.getLogger(__name__)

router = APIRouter()


def _redirect_uri(request: Request) -> str:
    """Reconstruct the absolute callback URL the IDP redirects back to.

    Three resolution tiers:

      1. ``ANAKOT_DASHBOARD_PUBLIC_URL`` env var or
         ``dashboard.public_url`` in config.yaml — when set, this is
         the complete authority (scheme + host + optional path prefix)
         and we append ``/auth/callback`` verbatim. ``X-Forwarded-Prefix``
         is IGNORED on this code path because the operator has declared
         the public URL — we no longer need to guess from proxy headers,
         and stacking the prefix on top would double-prefix the common
         case where the prefix is already baked into ``public_url``.
         Relief valve for deploys behind reverse proxies whose forwarded
         headers aren't reliable.

      2. ``X-Forwarded-Prefix: /anakot`` (Mission Control deploys) — we
         prepend the prefix to the path FastAPI's ``url_for`` produces
         (it doesn't natively honour this header — it isn't part of the
         Starlette/uvicorn proxy_headers set).

      3. Bare ``request.url_for("auth_callback")`` — under uvicorn's
         ``proxy_headers=True`` this picks up the public https URL from
         ``X-Forwarded-Host`` plus ``X-Forwarded-Proto``. Fly.io's
         default path.
    """
    from urllib.parse import urlparse, urlunparse

    from anakot_cli.dashboard_auth.prefix import (
        prefix_from_request,
        resolve_public_url,
    )

    # Tier 1: operator-declared public URL.
    public_url = resolve_public_url()
    if public_url:
        # ``public_url`` is the complete authority (possibly with a
        # path prefix already baked in). Append the auth callback path
        # verbatim. ``resolve_public_url`` already stripped any trailing
        # slash so we don't produce ``//auth/callback`` double-slashes.
        return f"{public_url}/auth/callback"

    # Tier 2 + 3: reconstruct from the request URL, optionally with
    # X-Forwarded-Prefix layered on top of the path.
    base = str(request.url_for("auth_callback"))
    prefix = prefix_from_request(request)
    if not prefix:
        return base
    parsed = urlparse(base)
    return urlunparse(parsed._replace(path=f"{prefix}{parsed.path}"))


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def _prefix(request: Request) -> str:
    """Resolve the X-Forwarded-Prefix header for the active request.

    Local indirection so the routes pass a consistent value to the
    cookie helpers (cookie name + Path attribute) and the gate's
    redirect builders (login_url construction). See
    ``anakot_cli.dashboard_auth.prefix`` for the normalisation rules.
    """
    from anakot_cli.dashboard_auth.prefix import prefix_from_request
    return prefix_from_request(request)


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Public: provider list for the login-page bootstrap
# ---------------------------------------------------------------------------


@router.get("/api/auth/providers", name="auth_providers")
async def api_auth_providers() -> Any:
    providers = list_providers()
    if not providers:
        # Q13: fail-closed when zero providers are registered.
        return JSONResponse(
            {"detail": "no auth providers registered"},
            status_code=503,
        )
    return {
        "providers": [
            {
                "name": p.name,
                "display_name": p.display_name,
                "supports_password": bool(
                    getattr(p, "supports_password", False)
                ),
            }
            for p in providers
        ],
    }


# ---------------------------------------------------------------------------
# Public: OAuth round trip
# ---------------------------------------------------------------------------


@router.get("/auth/login", name="auth_login")
async def auth_login(request: Request, provider: str, next: str = ""):
    p = get_provider(provider)
    if p is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown provider: {provider!r}",
        )

    try:
        ls = p.start_login(redirect_uri=_redirect_uri(request))
    except ProviderError as e:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=provider,
            reason="provider_unreachable",
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=503,
            detail=f"Provider unreachable: {e}",
        )

    audit_log(
        AuditEvent.LOGIN_START,
        provider=provider,
        ip=_client_ip(request),
    )

    resp = RedirectResponse(url=ls.redirect_url, status_code=302)
    # Pack the provider name into the PKCE cookie so the callback can
    # find it without a separate cookie. Provider may or may not have
    # already included a ``provider=`` segment.
    pkce = ls.cookie_payload.get("anakot_session_pkce", "")
    if "provider=" not in pkce:
        pkce = f"provider={provider};{pkce}" if pkce else f"provider={provider}"
    # Carry ``next=`` through the round trip in the PKCE cookie. Real
    # IDPs only echo back ``code`` + ``state`` on the callback URL, so
    # query-string transport would lose the value — the cookie is the
    # only server-controlled channel that survives. Validate before we
    # store it so an attacker who reaches /auth/login directly with
    # ``next=//evil.example`` can't poison the cookie.
    safe_next = _validate_post_login_target(next)
    if safe_next:
        from urllib.parse import quote
        pkce = f"{pkce};next={quote(safe_next, safe='')}"
    set_pkce_cookie(
        resp, payload=pkce, use_https=detect_https(request),
        prefix=_prefix(request),
    )
    return resp


@router.get("/auth/callback", name="auth_callback")
async def auth_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
    error_description: str = "",
):
    pkce_raw = read_pkce_cookie(request)
    if not pkce_raw:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            reason="missing_pkce_cookie",
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=400,
            detail="Missing PKCE state cookie",
        )

    # Parse ``provider=...;state=...;verifier=...;next=...`` — the
    # ``next`` segment is optional (only present when /auth/login was
    # given a next= query). All keys live in the same flat namespace;
    # ``next`` carries a URL-encoded path so it never contains ``;``.
    parts = dict(
        seg.split("=", 1) for seg in pkce_raw.split(";") if "=" in seg
    )
    provider_name = parts.get("provider", "")
    expected_state = parts.get("state", "")
    verifier = parts.get("verifier", "")
    # Read next= from the cookie ONLY. The IDP doesn't echo next= back
    # on the callback URL (it only carries ``code`` + ``state``), so any
    # next= query parameter on the callback URL is attacker-controlled
    # and MUST be ignored.
    next_from_cookie = parts.get("next", "")

    p = get_provider(provider_name)
    if p is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider in cookie: {provider_name!r}",
        )

    if error:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=provider_name,
            reason="idp_error",
            error=error,
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=400,
            detail=f"OAuth error from provider: {error} ({error_description})",
        )

    if not state or state != expected_state:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=provider_name,
            reason="state_mismatch",
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=400,
            detail="OAuth state mismatch (CSRF check failed)",
        )

    try:
        session = p.complete_login(
            code=code,
            state=state,
            code_verifier=verifier,
            redirect_uri=_redirect_uri(request),
        )
    except InvalidCodeError as e:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=provider_name,
            reason="invalid_code",
            ip=_client_ip(request),
        )
        raise HTTPException(status_code=400, detail=f"Invalid code: {e}")
    except ProviderError as e:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=provider_name,
            reason="provider_unreachable",
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=503,
            detail=f"Provider unreachable: {e}",
        )

    audit_log(
        AuditEvent.LOGIN_SUCCESS,
        provider=provider_name,
        user_id=session.user_id,
        email=session.email,
        org_id=session.org_id,
        ip=_client_ip(request),
    )

    expires_in = max(60, session.expires_at - int(time.time()))
    # Honour the ``next=`` value the gate's _unauth_response set in the
    # /login redirect URL and that /auth/login persisted into the PKCE
    # cookie. We re-validate against the same-origin rules here — the
    # cookie is server-set so this is defence in depth, but a regression
    # that lets attacker-controlled bytes into the cookie would otherwise
    # produce an open redirect.
    landing = _validate_post_login_target(next_from_cookie) or "/"
    resp = RedirectResponse(url=landing, status_code=302)
    set_session_cookies(
        resp,
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        access_token_expires_in=expires_in,
        use_https=detect_https(request),
        prefix=_prefix(request),
    )
    clear_pkce_cookie(resp, prefix=_prefix(request))
    return resp


def _validate_post_login_target(raw: str) -> str:
    """Return ``raw`` if it's a safe same-origin path, else empty string.

    The ``next`` query param survives a full OAuth round trip — the gate
    encodes it into the /login redirect, the login page emits it back into
    /auth/login, and the IDP preserves it across /authorize/callback. We
    have to re-validate here because the value came back in via the
    URL (an attacker could craft a /auth/callback URL with their own
    ``next=https://evil.example``).
    """
    if not raw:
        return ""
    from urllib.parse import unquote
    decoded = unquote(raw)
    if not decoded.startswith("/") or decoded.startswith("//"):
        return ""
    # Don't loop back to login pages or auth flow.
    if any(
        decoded == p or decoded.startswith(p)
        for p in ("/login", "/auth/", "/api/auth/")
    ):
        return ""
    # Reject any ``/api/*`` target. The gate's ``_safe_next_target``
    # already filters these out before they reach the cookie, but a
    # malicious or stale ``next=`` value that re-enters via the
    # callback URL must not be honoured: a successful redirect to an
    # API endpoint renders raw JSON in the browser address bar — never
    # a useful post-login destination, and indistinguishable from an
    # attacker trying to weaponise the redirect.
    if decoded == "/api" or decoded.startswith("/api/"):
        return ""
    return decoded


# ---------------------------------------------------------------------------
# Public: password (non-redirect) login
# ---------------------------------------------------------------------------
#
# Brute-force throttle. The OAuth flow has no guessable secret on our side
# (the IDP owns credentials), but ``/auth/password-login`` accepts a
# password we verify locally, so it's a credential-stuffing target. A
# simple in-process sliding-window limiter per client IP raises the cost
# of online guessing without any external dependency. It is intentionally
# best-effort: process-local (resets on restart), and behind a trusting
# proxy the IP is the proxy's unless X-Forwarded-For is set — which is why
# this is defence-in-depth on top of the provider's own constant-time
# verify, not the only line of defence.

_PW_RATE_MAX_ATTEMPTS = 10
_PW_RATE_WINDOW_SEC = 60.0
_pw_attempts: Dict[str, Deque[float]] = defaultdict(deque)
_pw_attempts_lock = threading.Lock()


def _password_rate_limited(ip: str) -> bool:
    """True if ``ip`` has exceeded the password-login attempt budget.

    Sliding window: prune attempts older than the window, then check the
    count. Records the attempt timestamp when allowed. An empty IP (no
    discernible client) shares a single bucket — fail-safe toward
    throttling rather than letting unattributable traffic through
    unmetered.
    """
    now = time.monotonic()
    cutoff = now - _PW_RATE_WINDOW_SEC
    key = ip or "_unknown_"
    with _pw_attempts_lock:
        bucket = _pw_attempts[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _PW_RATE_MAX_ATTEMPTS:
            return True
        bucket.append(now)
        return False


def _reset_password_rate_limit() -> None:
    """Test-only: clear all rate-limit buckets."""
    with _pw_attempts_lock:
        _pw_attempts.clear()


class _PasswordLoginBody(BaseModel):
    provider: str
    username: str
    password: str
    next: str = ""


@router.post("/auth/password-login", name="auth_password_login")
async def auth_password_login(request: Request, body: _PasswordLoginBody):
    """Authenticate a username/password against a password provider.

    Mirrors the cookie-minting tail of ``/auth/callback`` but skips the
    PKCE/state/code machinery (those are OAuth-only). On success sets the
    session cookies and returns JSON ``{"ok": true, "next": <path>}`` —
    the credential form POSTs via fetch and navigates client-side, so a
    302 (which fetch follows opaquely) is the wrong shape here.

    Failure modes, all deliberately generic so the endpoint can't be used
    as a username oracle or a provider-enumeration oracle:
      * unknown provider / provider lacks password support → 404
      * bad credentials → 401 ("Invalid credentials")
      * backing store unreachable → 503
      * too many attempts from this IP → 429
    """
    ip = _client_ip(request)
    if _password_rate_limited(ip):
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=body.provider,
            reason="rate_limited",
            ip=ip,
        )
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Try again shortly.",
        )

    p = get_provider(body.provider)
    if p is None or not getattr(p, "supports_password", False):
        # Don't leak which providers exist or which support passwords —
        # same 404 whether the provider is unknown or OAuth-only.
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=body.provider,
            reason="unknown_password_provider",
            ip=ip,
        )
        raise HTTPException(status_code=404, detail="Unknown provider")

    try:
        session = p.complete_password_login(
            username=body.username, password=body.password
        )
    except InvalidCredentialsError:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=body.provider,
            reason="invalid_credentials",
            ip=ip,
        )
        # Generic message — never distinguish unknown-user from wrong-password.
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except NotImplementedError:
        # supports_password was True but the method isn't actually
        # implemented — a provider bug, not a client error.
        raise HTTPException(status_code=500, detail="Provider misconfigured")
    except ProviderError as e:
        audit_log(
            AuditEvent.LOGIN_FAILURE,
            provider=body.provider,
            reason="provider_unreachable",
            ip=ip,
        )
        raise HTTPException(status_code=503, detail=f"Provider unreachable: {e}")

    audit_log(
        AuditEvent.LOGIN_SUCCESS,
        provider=body.provider,
        user_id=session.user_id,
        email=session.email,
        org_id=session.org_id,
        ip=ip,
    )

    expires_in = max(60, session.expires_at - int(time.time()))
    landing = _validate_post_login_target(body.next) or "/"
    resp = JSONResponse({"ok": True, "next": landing})
    set_session_cookies(
        resp,
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        access_token_expires_in=expires_in,
        use_https=detect_https(request),
        prefix=_prefix(request),
    )
    return resp


@router.post("/auth/logout", name="auth_logout")
async def auth_logout(request: Request):
    _at, rt = read_session_cookies(request)
    if rt:
        # Best-effort revoke. Try every provider so a session minted by
        # any registered provider is revoked correctly. Failures are
        # logged but never raised.
        for provider in list_providers():
            try:
                provider.revoke_session(refresh_token=rt)
            except Exception as e:  # noqa: BLE001 — best-effort
                _log.warning(
                    "dashboard-auth: revoke on %r failed: %s",
                    provider.name, e,
                )

    sess = getattr(request.state, "session", None)
    audit_log(
        AuditEvent.LOGOUT,
        provider=(sess.provider if sess else "unknown"),
        user_id=(sess.user_id if sess else ""),
        ip=_client_ip(request),
    )

    prefix = _prefix(request)
    resp = RedirectResponse(url=f"{prefix}/", status_code=302)
    clear_session_cookies(resp, prefix=prefix)
    clear_pkce_cookie(resp, prefix=prefix)
    return resp


# ---------------------------------------------------------------------------
# Auth-required: identity probe for the SPA
# ---------------------------------------------------------------------------


@router.get("/api/auth/me", name="auth_me")
async def api_auth_me(request: Request):
    """Return the verified session as JSON. Auth-required (gate enforces)."""
    sess = getattr(request.state, "session", None)
    if sess is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    import os

    is_admin = _is_admin_user(sess.user_id)
    # Migration fallback: if ANAKOT_ADMIN_EMAIL is set and matches,
    # treat as admin even without user-metadata.json entry.
    if not is_admin and sess.email:
        admin_email_env = os.environ.get("ANAKOT_ADMIN_EMAIL", "")
        if sess.email == admin_email_env:
            is_admin = True

    return {
        "user_id": sess.user_id,
        "email": sess.email,
        "display_name": sess.display_name,
        "org_id": sess.org_id,
        "provider": sess.provider,
        "expires_at": sess.expires_at,
        "is_admin": is_admin,
    }


# ---------------------------------------------------------------------------
# Auth-required: WS upgrade ticket (Phase 5)
# ---------------------------------------------------------------------------


@router.post("/api/auth/ws-ticket", name="auth_ws_ticket")
async def api_auth_ws_ticket(request: Request):
    """Mint a short-lived single-use ticket for the authenticated session.

    Browsers cannot set ``Authorization`` on a WebSocket upgrade, so in
    gated mode the SPA POSTs this endpoint to get a ``?ticket=`` value to
    append to ``/api/pty``, ``/api/ws``, ``/api/pub``, or ``/api/events``.

    The ticket has a 30-second TTL and is single-use. Calling this endpoint
    multiple times in quick succession (e.g. one ticket per WS) is the
    expected pattern.
    """
    sess = getattr(request.state, "session", None)
    if sess is None:
        # Middleware should already have rejected, but check defensively.
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Import here so the routes module stays usable in test contexts that
    # don't load the ticket store.
    from anakot_cli.dashboard_auth.ws_tickets import TTL_SECONDS, mint_ticket

    ticket = mint_ticket(user_id=sess.user_id, provider=sess.provider)
    audit_log(
        AuditEvent.WS_TICKET_MINTED,
        provider=sess.provider,
        user_id=sess.user_id,
        ip=_client_ip(request),
    )
    return {"ticket": ticket, "ttl_seconds": TTL_SECONDS}


# ---------------------------------------------------------------------------
# Auth-required: profile-for-user (multi-user routing)
# ---------------------------------------------------------------------------


@router.get("/api/auth/profile-for-user", name="auth_profile_for_user")
async def api_auth_profile_for_user(request: Request):
    """Return the profile name for the authenticated user.

    Returns ``{"profile": "alice"}`` if the user has been onboarded, or
    ``{"profile": null, "needs_onboarding": true}`` if this is a first-time
    user who hasn't picked a profile name yet.
    """
    sess = getattr(request.state, "session", None)
    if sess is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    from anakot_cli.dashboard_auth.user_profiles import get_profile_for_user, has_profile_for_user

    if has_profile_for_user(sess.user_id):
        profile = get_profile_for_user(sess.user_id)
        return {"profile": profile, "needs_onboarding": False}

    return {"profile": None, "needs_onboarding": True}


# ---------------------------------------------------------------------------
# Auth-required: onboarding (first-login profile creation)
# ---------------------------------------------------------------------------


class _OnboardBody(BaseModel):
    """POST body for ``/api/auth/onboard``."""

    display_name: str
    """The display name the user chose — becomes their profile name."""


@router.post("/api/auth/onboard", name="auth_onboard")
async def api_auth_onboard(request: Request, body: _OnboardBody):
    """Create a profile on first login.

    Validates the profile name (lowercase alphanumeric + hyphens/underscores),
    creates the Anakot profile via ``anakot profile create``, applies the
    global config as a fallback, and saves the user→profile mapping.

    Returns ``{"ok": true, "profile": <name>}`` on success.
    """
    sess = getattr(request.state, "session", None)
    if sess is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")

    # Sanitize to a valid profile name: lowercase, alphanumeric + hyphens/underscores
    profile_name = re.sub(r"[^a-z0-9_-]", "", display_name.lower().replace(" ", "-"))
    profile_name = profile_name[:63]  # Max 63 chars
    if not profile_name or not re.match(r"^[a-z0-9]", profile_name):
        raise HTTPException(
            status_code=400,
            detail="Display name must start with a letter or number",
        )

    from anakot_cli.dashboard_auth.user_profiles import (
        get_profile_for_user,
        has_profile_for_user,
        set_profile_for_user,
    )

    # Already onboarded?
    if has_profile_for_user(sess.user_id):
        existing = get_profile_for_user(sess.user_id)
        return {"ok": True, "profile": existing, "already_onboarded": True}

    # Check if profile name is taken
    all_mappings = _list_all_profile_names()
    if profile_name in all_mappings:
        # Generate a unique name by appending a number
        base = profile_name
        counter = 1
        while f"{base}-{counter}" in all_mappings:
            counter += 1
        profile_name = f"{base}-{counter}"
    # Also check if a profile directory already exists but isn't in the mapping
    from anakot_constants import get_anakot_home
    from pathlib import Path

    global_home = _resolve_global_home()
    profiles_dir = global_home / "profiles"
    existing_profiles = set()
    if profiles_dir.exists():
        existing_profiles = {d.name for d in profiles_dir.iterdir() if d.is_dir()}

    if profile_name in existing_profiles:
        base = profile_name
        counter = 1
        while f"{base}-{counter}" in existing_profiles:
            counter += 1
        profile_name = f"{base}-{counter}"

    # Create the profile in-process (more reliable than subprocess on Railway).
    # Run in a thread executor to avoid blocking the ASGI event loop.
    try:
        profile_dir = await asyncio.wait_for(
            asyncio.to_thread(
                create_profile,
                name=profile_name,
                no_alias=True,
                no_skills=False,
            ),
            timeout=20,
        )
    except asyncio.TimeoutError:
        _log.error("Profile creation timed out for %r", profile_name)
        raise HTTPException(status_code=500, detail="Profile creation timed out, please try again")
    except (ValueError, FileExistsError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        _log.exception("Failed to create profile %r", profile_name)
        raise HTTPException(status_code=500, detail="Failed to create profile")

    # Persist the mapping
    set_profile_for_user(sess.user_id, profile_name)

    # Symlink profile's config.yaml and .env to the global (admin-owned) files.
    # Every web user reads the admin's configuration (API keys, model providers,
    # tool settings) while only their skills/memory stay per-user. The symlink
    # target's ownership/permissions (root-owned in Docker, admin-owned otherwise)
    # prevent the agent from writing config changes back.
    _ensure_web_profile_config_links(profile_dir, global_home)

    _log.info(
        "Onboarded user %r → profile %r (display_name=%r)",
        sess.user_id, profile_name, display_name,
    )

    # Auto-assign admin to the very first user
    existing_users = _list_all_users_meta()
    if not existing_users:
        _set_user_role_meta(sess.user_id, "admin")
        _log.info("First user %r auto-promoted to admin", sess.user_id)

    return {"ok": True, "profile": profile_name, "needs_onboarding": False}


# ---------------------------------------------------------------------------
# Auth-required: set user role (admin management)
# ---------------------------------------------------------------------------


class _SetRoleBody(BaseModel):
    """POST body for ``/api/auth/set-role``."""

    user_id: str
    role: str  # "admin" or "user"


@router.post("/api/auth/set-role", name="auth_set_role")
async def api_auth_set_role(request: Request, body: _SetRoleBody):
    """Set a user's role. Only existing admins can call this."""
    sess = getattr(request.state, "session", None)
    if sess is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not _is_admin_user(sess.user_id):
        raise HTTPException(status_code=403, detail="Forbidden: admin role required")

    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")

    try:
        _set_user_role_meta(body.user_id, body.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit_log(
        AuditEvent.USER_ROLE_CHANGED,
        actor=sess.user_id,
        target=body.user_id,
        new_role=body.role,
    )

    return {"ok": True, "user_id": body.user_id, "role": body.role}


@router.post("/api/auth/propagate-config", name="auth_propagate_config")
async def api_auth_propagate_config(request: Request):
    """Re-symlink config.yaml/.env for every web profile.
    Call this after editing the global config.yaml to push changes to all
    existing user profiles. Only admins can call this endpoint.
    """
    sess = getattr(request.state, "session", None)
    if sess is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not _is_admin_user(sess.user_id):
        raise HTTPException(status_code=403, detail="Forbidden: admin role required")

    global_home = _resolve_global_home()
    results: dict[str, str] = {}

    for profile_name in sorted(_list_all_profile_names()):
        if not profile_name.startswith("web-"):
            continue
        try:
            from anakot_cli.profiles import get_profile_dir as _get_profile_dir

            profile_dir = _get_profile_dir(profile_name)
            _ensure_web_profile_config_links(profile_dir, global_home)
            results[profile_name] = "ok"
        except Exception as exc:
            results[profile_name] = f"error: {exc}"
            _log.warning("propagate-config failed for %s: %s", profile_name, exc)

    return {"ok": True, "results": results}


def _resolve_global_home() -> Path:
    """Return the root ANAKOT_HOME (outside any profile)."""
    from anakot_constants import get_anakot_home
    home = get_anakot_home()
    if home.parent.name == "profiles":
        return home.parent.parent
    return home


def _ensure_web_profile_config_links(profile_dir: Path, global_home: Path) -> None:
    """Symlink profile config.yaml → global admin-owned file.

    Removes any existing config.yaml in the profile dir and replaces
    it with a relative symlink to the global admin config. The target
    file is owned by root/admin with restricted write perms so the
    agent runtime user cannot persist config changes.

    Note: .env is NOT symlinked — Railway injects API keys via system
    env vars natively; profiles without a local .env fall back to that.

    Best-effort: failures are logged but do not abort onboarding.
    """
    import os as _os

    name = "config.yaml"
    global_path = global_home / name
    profile_path = profile_dir / name

    # Remove existing file/dir/symlink if present
    try:
        if profile_path.is_symlink() or profile_path.exists():
            profile_path.unlink()
    except OSError as exc:
        _log.warning("Could not remove existing %s in profile: %s", name, exc)
        return

    # Only symlink if the global file exists
    if not global_path.exists():
        _log.info("Global %s not found at %s — skipping symlink", name, global_path)
        return

    try:
        # Relative symlink survives volume remounts
        rel = _os.path.relpath(global_path, profile_dir)
        profile_path.symlink_to(rel)
        _log.debug("Symlinked profile %s → %s", profile_path, rel)
    except OSError as exc:
        _log.warning("Could not symlink %s in profile: %s", name, exc)


def _list_all_profile_names() -> set[str]:
    """Return all profile names from the user→profile mapping."""
    from anakot_cli.dashboard_auth.user_profiles import list_all_mappings
    return set(list_all_mappings().values())
