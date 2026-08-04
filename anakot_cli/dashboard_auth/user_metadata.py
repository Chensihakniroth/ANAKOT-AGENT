"""Per-user metadata (role, settings) persisted at the ANAKOT_HOME level.

File location: {global_anakot_home}/user-metadata.json

Structure::

    {
        "google-12345": { "role": "admin" },
        "google-67890": { "role": "user" }
    }

Thread-safe, with an in-memory cache (same pattern as ``user_profiles.py``).
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Optional

from anakot_constants import get_anakot_home

_log = logging.getLogger(__name__)

_LOCK = threading.RLock()
_CACHE: dict[str, dict] | None = None  # None = not loaded


def _get_global_anakot_home() -> Path:
    """Return the root ANAKOT_HOME (outside any profile)."""
    home = get_anakot_home()
    if home.parent.name == "profiles":
        return home.parent.parent
    return home


def _metadata_path() -> Path:
    """Path to the user→metadata mapping file, at the global level."""
    return _get_global_anakot_home() / "user-metadata.json"


def _load_all() -> dict[str, dict]:
    """Load all user metadata (thread-safe, cached)."""
    global _CACHE
    with _LOCK:
        if _CACHE is not None:
            return _CACHE
        path = _metadata_path()
        if not path.exists():
            _CACHE = {}
            return _CACHE
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            _CACHE = data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError) as e:
            _log.warning("Failed to load user-metadata.json: %s", e)
            _CACHE = {}
        return _CACHE


def _save_all(mapping: dict[str, dict]) -> None:
    """Persist all user metadata to disk (thread-safe)."""
    path = _metadata_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_user_role(user_id: str) -> str:
    """Return the role for *user_id* ('admin' or 'user'). Defaults to 'user'."""
    all_meta = _load_all()
    meta = all_meta.get(user_id, {})
    return meta.get("role", "user")


def is_admin(user_id: str) -> bool:
    """Return True if *user_id* has role 'admin'."""
    return get_user_role(user_id) == "admin"


def set_user_role(user_id: str, role: str) -> None:
    """Set the role for *user_id* (must be 'admin' or 'user')."""
    if role not in ("admin", "user"):
        raise ValueError(f"Invalid role: {role!r}. Must be 'admin' or 'user'.")
    with _LOCK:
        all_meta = _load_all()
        if user_id in all_meta:
            all_meta[user_id]["role"] = role
        else:
            all_meta[user_id] = {"role": role}
        _save_all(all_meta)
        _CACHE = all_meta


def get_metadata(user_id: str) -> dict:
    """Return all metadata for *user_id* (empty dict if none)."""
    all_meta = _load_all()
    return dict(all_meta.get(user_id, {}))


def list_all_users() -> dict[str, dict]:
    """Return all {user_id → metadata} for admin management UI.

    Merges data from THREE persistent sources so every registered user
    appears in the admin panel:
      1. user-metadata.json — role, display_name, email, etc.
      2. config.yaml auth.users — password-registered users
      3. user-profiles.json — every onboarded user (OAuth + password)
    """
    import json as _json

    result = dict(_load_all())

    # Resolve the global ANAKOT_HOME (outside any profile)
    try:
        from anakot_constants import get_anakot_home as _gah
        _home = _gah()
        _global_home = _home.parent.parent if _home.parent.name == "profiles" else _home
    except Exception:
        _global_home = None

    # Source 2: config.yaml auth.users (password-registered users)
    if _global_home is not None:
        try:
            import yaml
            config_path = _global_home / "config.yaml"
            if config_path.exists():
                raw_cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
                if isinstance(raw_cfg, dict):
                    auth_users = raw_cfg.get("auth", {}).get("users", {})
                    if isinstance(auth_users, dict):
                        for uid, info in auth_users.items():
                            if uid not in result:
                                meta = {"role": "user"}
                                if isinstance(info, dict):
                                    if info.get("display_name"):
                                        meta["display_name"] = info["display_name"]
                                    if info.get("email"):
                                        meta["email"] = info["email"]
                                    if info.get("role"):
                                        meta["role"] = info["role"]
                                result[uid] = meta
        except Exception:
            pass

    # Source 3: user-profiles.json — every user who onboarded (OAuth + password)
    if _global_home is not None:
        try:
            profiles_path = _global_home / "user-profiles.json"
            if profiles_path.exists():
                raw_profiles = _json.loads(profiles_path.read_text(encoding="utf-8"))
                if isinstance(raw_profiles, dict):
                    for uid, entry in raw_profiles.items():
                        if uid not in result:
                            meta = {"role": "user"}
                            if isinstance(entry, dict):
                                meta["profile"] = entry.get("active", "")
                            elif isinstance(entry, str):
                                meta["profile"] = entry
                            result[uid] = meta
        except Exception:
            pass

    return result


def set_user_disabled(user_id: str, disabled: bool) -> None:
    """Set the disabled flag for *user_id*."""
    with _LOCK:
        all_meta = _load_all()
        if user_id not in all_meta:
            all_meta[user_id] = {}
        all_meta[user_id]["disabled"] = disabled
        _save_all(all_meta)
        _CACHE = all_meta


def is_user_disabled(user_id: str) -> bool:
    """Return True if *user_id* has been disabled."""
    meta = _load_all().get(user_id, {})
    return bool(meta.get("disabled", False))


def delete_user(user_id: str) -> bool:
    """Remove *user_id* from the metadata store entirely.

    Also removes the user→profile mapping and the profile directory.
    Returns True if the user existed, False otherwise.
    """
    from anakot_cli.dashboard_auth.user_profiles import (
        remove_profile_for_user,
    )
    from pathlib import Path
    from anakot_constants import get_anakot_home

    existed = False
    with _LOCK:
        all_meta = _load_all()
        if user_id in all_meta:
            del all_meta[user_id]
            existed = True
            _save_all(all_meta)
            _CACHE = all_meta

    # Remove profile mapping
    remove_profile_for_user(user_id)

    # Attempt to remove the profile data directory
    home = get_anakot_home()
    profile_dir = home.parent / "profiles" / user_id if home.parent.name == "profiles" else home / user_id
    if profile_dir.exists():
        import shutil
        shutil.rmtree(profile_dir, ignore_errors=True)

    return existed


def update_user_metadata(user_id: str, *, set_fields: dict | None = None, remove_fields: list[str] | None = None) -> dict:
    """Atomically update a user's metadata entry.

    Sets or removes named fields under ``_LOCK`` and returns the
    complete entry after the mutation.
    """
    with _LOCK:
        all_meta = _load_all()
        if user_id not in all_meta:
            all_meta[user_id] = {}
        entry = all_meta[user_id]
        if set_fields:
            entry.update(set_fields)
        if remove_fields:
            for k in remove_fields:
                entry.pop(k, None)
        _save_all(all_meta)
        _CACHE = all_meta
    return dict(entry)


def ensure_user_exists(user_id: str, *, display_name: str = "", email: str = "", provider: str = "") -> None:
    """Ensure *user_id* has an entry in user-metadata.json.

    Called on every successful login so the admin Users tab always shows
    every registered user.  Existing fields are never overwritten — only
    missing ones are filled in.
    """
    with _LOCK:
        all_meta = _load_all()
        meta = all_meta.get(user_id, {})
        changed = False
        if not meta.get("role"):
            meta.setdefault("role", "user")
            changed = True
        if display_name and not meta.get("display_name"):
            meta["display_name"] = display_name
            changed = True
        if email and not meta.get("email"):
            meta["email"] = email
            changed = True
        if provider and not meta.get("provider"):
            meta["provider"] = provider
            changed = True
        if changed:
            all_meta[user_id] = meta
            _save_all(all_meta)
            _CACHE = all_meta
