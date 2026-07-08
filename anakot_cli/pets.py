"""Config-write helpers for the pet display settings.

These are used by the gateway RPC handlers and CLI commands to toggle the pet
on/off, set the active pet, and change scale.  Config mutations go through the
standard ``load_config`` / ``save_config`` cycle so the YAML on disk stays
consistent.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from anakot_cli.config import load_config, save_config
from agent.pet.constants import MIN_SCALE, MAX_SCALE, DEFAULT_SCALE
from agent.pet.store import installed_pets, load_pet


def _set_active(slug: str) -> bool:
    """Set the active pet slug in config.  Returns True if changed."""
    slug = slug.strip().lower() if slug else ""
    cfg = load_config()
    display = _display(cfg)
    old = display.get("pet", {}).get("slug", "")
    if old == slug:
        return False
    cfg.setdefault("display", {}).setdefault("pet", {})["slug"] = slug
    save_config(cfg)
    return True


def _set_enabled(enabled: bool) -> bool:
    """Set the pet enabled/disabled in config.  Returns True if changed."""
    cfg = load_config()
    display = _display(cfg)
    old = display.get("pet", {}).get("enabled", True)
    if bool(old) == enabled:
        return False
    cfg.setdefault("display", {}).setdefault("pet", {})["enabled"] = enabled
    save_config(cfg)
    return True


def set_pet_scale(scale: float) -> bool:
    """Set the pet scale in config.  Returns True if changed."""
    scale = max(MIN_SCALE, min(MAX_SCALE, scale))
    cfg = load_config()
    display = _display(cfg)
    old = display.get("pet", {}).get("scale", DEFAULT_SCALE)
    if abs(float(old) - scale) < 0.001:
        return False
    cfg.setdefault("display", {}).setdefault("pet", {})["scale"] = scale
    save_config(cfg)
    return True


def _clear_active_if(slug: str) -> None:
    """Clear ``display.pet.slug`` if it matches *slug*."""
    if not slug:
        return
    slug = slug.strip().lower()
    cfg = load_config()
    active = cfg.get("display", {}).get("pet", {}).get("slug", "")
    if active != slug:
        return
    cfg.setdefault("display", {}).setdefault("pet", {})["slug"] = ""
    save_config(cfg)


def _rename_active_if(old_slug: str, new_slug: str) -> None:
    """Update the config slug if the active pet was renamed."""
    if not old_slug or not new_slug:
        return
    old_slug = old_slug.strip().lower()
    new_slug = new_slug.strip().lower()
    if old_slug == new_slug:
        return
    cfg = load_config()
    active = cfg.get("display", {}).get("pet", {}).get("slug", "")
    if active != old_slug:
        return
    cfg.setdefault("display", {}).setdefault("pet", {})["slug"] = new_slug
    save_config(cfg)


def config() -> dict:
    """Return the current ``display.pet`` config dict (never mutated)."""
    return {**load_config().get("display", {}).get("pet", {})}


def active_slug() -> str:
    """Return the configured active pet slug or empty string."""
    return str(config().get("slug", ""))


def active_scale() -> float:
    """Return the configured scale, clamped to allowed range."""
    s = float(config().get("scale", DEFAULT_SCALE))
    return max(MIN_SCALE, min(MAX_SCALE, s))


def active_enabled() -> bool:
    """Return whether the pet display is enabled."""
    return bool(config().get("enabled", True))


def _display(cfg: dict[str, Any]) -> dict:
    return cfg.setdefault("display", {})
