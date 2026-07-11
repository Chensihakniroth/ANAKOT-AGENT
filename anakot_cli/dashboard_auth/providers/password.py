"""Password-based dashboard auth provider.

Reads users from the *global* ANAKOT_HOME config.yaml (not the profile's
config). Each user is a key under ``auth.users``:

.. code-block:: yaml

   auth:
     users:
       alice@example.com:
         password_hash: "scrypt:16384:8:1:<salt_hex>:<hash_hex>"
       bob@example.com:
         password_hash: "scrypt:16384:8:1:<salt_hex>:<hash_hex>"

Generate a hash with::

    python -c "from anakot_cli.dashboard_auth.providers.password import hash_password; print(hash_password('your-password'))"

Token format
~~~~~~~~~~~~
The ``access_token`` is a signed JWT-like opaque token (just a random
hex string for simplicity — enough for a self-hosted setup). The
``refresh_token`` is another random hex string. They are stored in
memory (no persistence) so a server restart logs everyone out — which
is acceptable for a small self-hosted setup.

If persistence across restarts is needed, swap in a real JWT with
``itsdangerous`` or ``PyJWT`` (already a dependency).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import threading
import time
from typing import Optional

from anakot_cli.dashboard_auth.base import (
    DashboardAuthProvider,
    InvalidCredentialsError,
    LoginStart,
    ProviderError,
    RefreshExpiredError,
    Session,
)
from anakot_cli.dashboard_auth.user_profiles import (
    has_profile_for_user,
    get_profile_for_user,
    set_profile_for_user,
    remove_profile_for_user,
)

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Password hashing (stdlib only — no bcrypt dependency needed)
# ---------------------------------------------------------------------------

_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64
_SALT_BYTES = 32
_TOKEN_BYTES = 48  # 96 hex chars
_TOKEN_TTL = 14 * 86400  # 14 days for access + refresh


def hash_password(password: str) -> str:
    """Return a portable scrypt-hashed representation of *password*.

    Format: ``scrypt:{n}:{r}:{p}:{salt_hex}:{hash_hex}``
    """
    salt = os.urandom(_SALT_BYTES)
    dk = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        maxmem=0,
        dklen=_SCRYPT_DKLEN,
    )
    return (
        f"scrypt:{_SCRYPT_N}:{_SCRYPT_R}:{_SCRYPT_P}:"
        f"{salt.hex()}:{dk.hex()}"
    )


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time password verification against *encoded* (our format)."""
    parts = encoded.split(":")
    if parts[0] != "scrypt":
        # Unknown format — fail closed
        _log.warning("Unknown password hash format: %s", parts[0])
        return False
    try:
        n, r, p = map(int, parts[1:4])
        salt = bytes.fromhex(parts[4])
        expected = bytes.fromhex(parts[5])
    except (ValueError, IndexError) as e:
        _log.warning("Malformed password hash: %s", e)
        return False

    actual = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        maxmem=0,
        dklen=len(expected),
    )
    return hmac.compare_digest(actual, expected)


# ---------------------------------------------------------------------------
# In-memory token store
# ---------------------------------------------------------------------------

_TOKEN_STORE: dict[str, dict] = {}
_TOKEN_STORE_LOCK = threading.Lock()
_TOKEN_STORE_LOADED = False


def _generate_token() -> str:
    return os.urandom(_TOKEN_BYTES).hex()


def _store_session(user_id: str, email: str, display_name: str) -> Session:
    """Create tokens and store the session in-memory. Returns the Session."""
    now = int(time.time())
    access_token = _generate_token()
    refresh_token = _generate_token()
    expires_at = now + _TOKEN_TTL

    with _TOKEN_STORE_LOCK:
        _TOKEN_STORE[access_token] = {
            "user_id": user_id,
            "email": email,
            "display_name": display_name,
            "provider": "password",
            "expires_at": expires_at,
            "refresh_token": refresh_token,
        }
        _TOKEN_STORE[refresh_token] = {
            "_is_refresh": True,
            "access_token": access_token,
        }

    return Session(
        user_id=user_id,
        email=email,
        display_name=display_name,
        org_id="",
        provider="password",
        expires_at=expires_at,
        access_token=access_token,
        refresh_token=refresh_token,
    )


def _rotate_session(refresh_token: str) -> Optional[Session]:
    """Rotate an expired session using its refresh token."""
    with _TOKEN_STORE_LOCK:
        entry = _TOKEN_STORE.get(refresh_token)
        if not entry or not entry.get("_is_refresh"):
            return None
        old_at = entry.get("access_token")
        old_session = _TOKEN_STORE.get(old_at) if old_at else None
        if not old_session:
            # Refresh token references a dead access token
            _TOKEN_STORE.pop(refresh_token, None)
            return None

        # Revoke old tokens
        _TOKEN_STORE.pop(old_at, None)
        _TOKEN_STORE.pop(refresh_token, None)

        # Mint new ones
        user_id = old_session["user_id"]
        email = old_session.get("email", user_id)
        display_name = old_session.get("display_name", user_id)

    return _store_session(user_id, email, display_name)


def _verify_access_token(access_token: str) -> Optional[Session]:
    """Return a Session if *access_token* is valid and not expired."""
    with _TOKEN_STORE_LOCK:
        entry = _TOKEN_STORE.get(access_token)
        if not entry or entry.get("_is_refresh"):
            return None
        if int(time.time()) > entry.get("expires_at", 0):
            _TOKEN_STORE.pop(access_token, None)
            rt = entry.get("refresh_token")
            if rt:
                _TOKEN_STORE.pop(rt, None)
            return None

    return Session(
        user_id=entry["user_id"],
        email=entry.get("email", entry["user_id"]),
        display_name=entry.get("display_name", entry["user_id"]),
        org_id="",
        provider="password",
        expires_at=entry["expires_at"],
        access_token=access_token,
        refresh_token=entry["refresh_token"],
    )


# ---------------------------------------------------------------------------
# Config reader
# ---------------------------------------------------------------------------


def _read_users_from_config() -> dict[str, str]:
    """Read ``auth.users`` from the *global* config.yaml.

    Returns ``{user_id: password_hash}``.
    """
    # Load the config — but we want the GLOBAL config, not the
    # profile-level config. Since ANAKOT_HOME could be inside a
    # profile, resolve the root config manually.
    from pathlib import Path
    from anakot_cli.config import get_config_path
    from anakot_constants import get_anakot_home

    # Build global config path
    home = get_anakot_home()
    if home.parent.name == "profiles":
        global_home = home.parent.parent
    else:
        global_home = home
    global_config_path = global_home / "config.yaml"

    if not global_config_path.exists():
        return {}

    try:
        import yaml
        raw = yaml.safe_load(global_config_path.read_text(encoding="utf-8"))
    except Exception as e:
        _log.warning("Failed to read global config for users: %s", e)
        return {}

    if not isinstance(raw, dict):
        return {}
    users = raw.get("auth", {}).get("users", {})
    if not isinstance(users, dict):
        return {}
    result: dict[str, str] = {}
    for uid, info in users.items():
        if isinstance(info, dict) and "password_hash" in info:
            result[uid] = info["password_hash"]
        elif isinstance(info, str):
            # Simple format: userId: hash_string
            result[uid] = info
    return result


# ---------------------------------------------------------------------------
# The provider class
# ---------------------------------------------------------------------------


class PasswordAuthProvider(DashboardAuthProvider):
    """Authenticate users via username/password against global config."""

    name = "password"
    display_name = "Password"
    supports_password = True

    def __init__(self) -> None:
        self._users_cache: dict[str, str] = {}
        self._cache_lock = threading.Lock()
        self._cache_expires: float = 0
        self._cache_ttl = 30.0  # seconds — config file may be edited

    def _get_users(self) -> dict[str, str]:
        """Read users with a short-lived cache."""
        now = time.monotonic()
        with self._cache_lock:
            if now < self._cache_expires and self._users_cache:
                return self._users_cache
            self._users_cache = _read_users_from_config()
            self._cache_expires = now + self._cache_ttl
            return self._users_cache

    # --- OAuth stubs (not used — password-only provider) ---

    def start_login(self, *, redirect_uri: str) -> LoginStart:
        raise NotImplementedError("PasswordProvider does not support OAuth redirect")

    def complete_login(
        self,
        *,
        code: str,
        state: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> Session:
        raise NotImplementedError("PasswordProvider does not support OAuth callback")

    # --- Password login ---

    def complete_password_login(
        self, *, username: str, password: str
    ) -> Session:
        """Verify password against the global config user list."""
        users = self._get_users()
        stored_hash = users.get(username)
        if stored_hash is None:
            # Constant-time fake verification to prevent user enumeration
            # (verify against a dummy hash so timing doesn't reveal existence)
            _verify_dummy(password)
            raise InvalidCredentialsError("Invalid credentials")

        if not verify_password(password, stored_hash):
            raise InvalidCredentialsError("Invalid credentials")

        # Good login — create session
        return _store_session(
            user_id=username,
            email=username,
            display_name=username.split("@")[0] if "@" in username else username,
        )

    # --- Session lifecycle ---

    def verify_session(self, *, access_token: str) -> Optional[Session]:
        return _verify_access_token(access_token)

    def refresh_session(self, *, refresh_token: str) -> Session:
        result = _rotate_session(refresh_token)
        if result is None:
            raise RefreshExpiredError("Refresh token expired or revoked")
        return result

    def revoke_session(self, *, refresh_token: str) -> None:
        with _TOKEN_STORE_LOCK:
            entry = _TOKEN_STORE.pop(refresh_token, None)
            if entry and entry.get("access_token"):
                _TOKEN_STORE.pop(entry["access_token"], None)


# ---------------------------------------------------------------------------
# Helper: constant-time dummy verification
# ---------------------------------------------------------------------------

_DUMMY_HASH = hash_password("dummy-constant-time-guard")


def _verify_dummy(password: str) -> None:
    """Run a constant-time password hash to prevent timing oracles.

    Even when the username doesn't exist, we spend ~similar CPU cycles
    as a real verification so an attacker can't distinguish "user exists"
    from "user doesn't exist" by response timing.
    """
    verify_password(password, _DUMMY_HASH)


def cli_hash() -> None:
    """CLI entry-point: hash a password and print the encoded string.

    Usage::

        python -c "from anakot_cli.dashboard_auth.providers.password import cli_hash; cli_hash()"
    """
    import sys
    pwd = sys.argv[1] if len(sys.argv) > 1 else input("Password: ")
    print(hash_password(pwd))
