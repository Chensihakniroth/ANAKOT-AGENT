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
    """Return all {user_id → metadata} for admin management UI."""
    return dict(_load_all())
