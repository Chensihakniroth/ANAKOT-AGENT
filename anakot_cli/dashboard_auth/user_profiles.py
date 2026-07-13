"""User → profile mapping for multi-user support.

Maps authenticated user IDs to Anakot profile names. Persisted as a JSON
file at the global ANAKOT_HOME level (outside any profile).

File location: {global_anakot_home}/user-profiles.json
"""
from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Optional

from anakot_constants import get_anakot_home

_log = logging.getLogger(__name__)

_USER_PROFILES_LOCK = threading.RLock()
_USER_PROFILES_CACHE: dict[str, str] | None = None  # None = not loaded


def _get_global_anakot_home() -> Path:
    """Return the root ANAKOT_HOME (outside any profile).

    When inside a profile (ANAKOT_HOME/profiles/<name>/), the root
    is the parent of the profiles/ directory. Otherwise we're at root.
    """
    home = get_anakot_home()
    if home.parent.name == "profiles":
        return home.parent.parent
    return home


def _user_profiles_path() -> Path:
    """Path to the user→profile mapping file, at the global level."""
    return _get_global_anakot_home() / "user-profiles.json"


def _load_mapping() -> dict[str, str]:
    """Load the user→profile mapping from disk (thread-safe, cached)."""
    global _USER_PROFILES_CACHE
    with _USER_PROFILES_LOCK:
        if _USER_PROFILES_CACHE is not None:
            return _USER_PROFILES_CACHE
        path = _user_profiles_path()
        if not path.exists():
            _USER_PROFILES_CACHE = {}
            return _USER_PROFILES_CACHE
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            _USER_PROFILES_CACHE = data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError) as e:
            _log.warning("Failed to load user-profiles.json: %s", e)
            _USER_PROFILES_CACHE = {}
        return _USER_PROFILES_CACHE


def _save_mapping(mapping: dict[str, str]) -> None:
    """Persist the user→profile mapping to disk (thread-safe)."""
    path = _user_profiles_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(mapping, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_profile_for_user(user_id: str) -> Optional[str]:
    """Return the profile name for *user_id*, or None if not mapped."""
    mapping = _load_mapping()
    return mapping.get(user_id)


def set_profile_for_user(user_id: str, profile_name: str) -> None:
    """Map *user_id* to *profile_name* and persist."""
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        mapping[user_id] = profile_name
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping


def remove_profile_for_user(user_id: str) -> None:
    """Remove the mapping for *user_id*."""
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        mapping.pop(user_id, None)
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping


def has_profile_for_user(user_id: str) -> bool:
    """Check if a user has been mapped to a profile."""
    return get_profile_for_user(user_id) is not None


def list_all_mappings() -> dict[str, str]:
    """Return all user→profile mappings."""
    return dict(_load_mapping())


def clear_cache() -> None:
    """Test-only: reset the in-memory cache."""
    global _USER_PROFILES_CACHE
    with _USER_PROFILES_LOCK:
        _USER_PROFILES_CACHE = None
