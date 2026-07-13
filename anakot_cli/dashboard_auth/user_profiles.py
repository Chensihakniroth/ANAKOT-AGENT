"""User → profile mapping for multi-user support.

Maps authenticated user IDs to one or more Anakot profile names (1:N).
Persisted as a JSON file at the global ANAKOT_HOME level (outside any
profile).  Supports both the legacy 1:1 format

    {"user_id": "profile_name"}

and the current 1:N format

    {"user_id": {"active": "default", "profiles": ["default", "work"]}}

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
_USER_PROFILES_CACHE: dict[str, dict] | None = None  # None = not loaded


# ---------------------------------------------------------------------------
# Internal helpers (normalise legacy → current format)
# ---------------------------------------------------------------------------


def _normalise_entry(value: object) -> dict:
    """Convert a stored value to ``{"active": str, "profiles": list[str]}``.

    Legacy 1:1 format (bare string) is converted automatically.
    """
    if isinstance(value, dict):
        entry = dict(value)
        if "profiles" not in entry:
            entry["profiles"] = [entry.get("active", "default")]
        if "active" not in entry:
            active = entry["profiles"][0] if entry["profiles"] else "default"
            entry["active"] = active
        return entry
    # old format: bare string
    name = str(value) if value else "default"
    return {"active": name, "profiles": [name]}


def _mapping_as_store(mapping: dict[str, dict]) -> dict:
    """Convert the in-memory normalised mapping back to the on-disk shape.

    Simple 1:1 entries (single profile matching active) are stored as
    a bare string for backward-compatible diffs.  1:N entries are stored
    as the full dict.
    """
    result: dict = {}
    for uid, entry in mapping.items():
        if len(entry.get("profiles", [])) == 1 and entry.get("active") == entry["profiles"][0]:
            result[uid] = entry["profiles"][0]
        else:
            result[uid] = dict(entry)
    return result


# ---------------------------------------------------------------------------
# File I/O
# ---------------------------------------------------------------------------


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


def _load_mapping() -> dict[str, dict]:
    """Load and normalise the mapping from disk (thread-safe, cached)."""
    global _USER_PROFILES_CACHE
    with _USER_PROFILES_LOCK:
        if _USER_PROFILES_CACHE is not None:
            return _USER_PROFILES_CACHE
        path = _user_profiles_path()
        if not path.exists():
            _USER_PROFILES_CACHE = {}
            return _USER_PROFILES_CACHE
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raw = {}
            normalised = {k: _normalise_entry(v) for k, v in raw.items()}
            _USER_PROFILES_CACHE = normalised
        except (json.JSONDecodeError, OSError) as e:
            _log.warning("Failed to load user-profiles.json: %s", e)
            _USER_PROFILES_CACHE = {}
        return _USER_PROFILES_CACHE


def _save_mapping(mapping: dict[str, dict]) -> None:
    """Persist the mapping to disk (thread-safe)."""
    path = _user_profiles_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    store = _mapping_as_store(mapping)
    path.write_text(
        json.dumps(store, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Public API  (1:N — new callers)
# ---------------------------------------------------------------------------


def get_user_profiles(user_id: str) -> dict:
    """Return the profile entry for *user_id*: ``{"active": ..., "profiles": [...]}``.

    Returns an *empty* dict when the user has no mapping (caller checks
    ``"profiles" in result`` or ``result.get("profiles", [])``).
    """
    mapping = _load_mapping()
    entry = mapping.get(user_id)
    return dict(entry) if entry else {}


def set_user_profiles(user_id: str, active: str, profiles: list[str]) -> None:
    """Replace the entire profile entry for *user_id*."""
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        entry = {"active": active, "profiles": list(profiles)}
        mapping[user_id] = entry
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping


def switch_profile_for_user(user_id: str, profile_name: str) -> bool:
    """Set the *active* profile for *user_id*.

    Returns True on success, False if *profile_name* is not in the
    user's available profiles.
    """
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        entry = mapping.get(user_id)
        if not entry:
            return False
        if profile_name not in entry["profiles"]:
            return False
        entry["active"] = profile_name
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping
    return True


def add_profile_for_user(user_id: str, profile_name: str) -> bool:
    """Add a profile name to *user_id*'s available list.

    Returns True if the profile was added, False if it already existed.
    """
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        entry = mapping.get(user_id)
        if not entry:
            # Create new entry with this as the only + active profile
            mapping[user_id] = {"active": profile_name, "profiles": [profile_name]}
            _save_mapping(mapping)
            _USER_PROFILES_CACHE = mapping
            return True
        if profile_name in entry["profiles"]:
            return False
        entry["profiles"].append(profile_name)
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping
    return True


def remove_user_profile(user_id: str, profile_name: str) -> bool:
    """Remove a profile name from *user_id*'s list.

    Will not remove the last profile.  If the removed profile was the
    active one, switches to the first remaining profile.
    Returns True if the profile was found and removed.
    """
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        entry = mapping.get(user_id)
        if not entry:
            return False
        if profile_name not in entry["profiles"]:
            return False
        if len(entry["profiles"]) <= 1:
            return False  # refuse to orphan the user
        entry["profiles"].remove(profile_name)
        if entry["active"] == profile_name:
            entry["active"] = entry["profiles"][0]
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping
    return True


# ---------------------------------------------------------------------------
# Backward-compatible 1:1 API  (existing callers unchanged)
# ---------------------------------------------------------------------------


def get_profile_for_user(user_id: str) -> Optional[str]:
    """Return the *active* profile name for *user_id*, or None."""
    entry = get_user_profiles(user_id)
    return entry.get("active") if entry else None


def set_profile_for_user(user_id: str, profile_name: str) -> None:
    """Map *user_id* to *profile_name* (sets active + adds to list)."""
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        entry = mapping.get(user_id)
        if entry:
            entry["active"] = profile_name
            if profile_name not in entry["profiles"]:
                entry["profiles"].append(profile_name)
        else:
            mapping[user_id] = {"active": profile_name, "profiles": [profile_name]}
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping


def remove_profile_for_user(user_id: str) -> None:
    """Remove ALL profiles for *user_id* (legacy compatibility)."""
    with _USER_PROFILES_LOCK:
        mapping = _load_mapping()
        mapping.pop(user_id, None)
        _save_mapping(mapping)
        _USER_PROFILES_CACHE = mapping


def has_profile_for_user(user_id: str) -> bool:
    """Check if a user has been mapped to at least one profile."""
    return get_profile_for_user(user_id) is not None


def list_all_mappings() -> dict[str, str]:
    """Return a flat {user_id → active_profile_name} view."""
    mapping = _load_mapping()
    return {uid: e["active"] for uid, e in mapping.items()}


def list_all_profiles() -> dict[str, dict]:
    """Return the full {user_id → entry} view (1:N)."""
    return {k: dict(v) for k, v in _load_mapping().items()}


def clear_cache() -> None:
    """Test-only: reset the in-memory cache."""
    global _USER_PROFILES_CACHE
    with _USER_PROFILES_LOCK:
        _USER_PROFILES_CACHE = None
