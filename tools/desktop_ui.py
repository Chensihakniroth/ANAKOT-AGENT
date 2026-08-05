#!/usr/bin/env python3
"""Bridge desktop-gated tools to anakot-desktop renderer events.

Reactions, preview panes, and other renderer-only affordances reach the
desktop through an emitter the desktop ``tui_gateway`` installs at session
start via :func:`set_emitter`. Everywhere else it stays ``None`` and the
tools report \"desktop only\". Routing keys off ``ANAKOT_SESSION_KEY`` so the
event lands on the window that owns the turn.
"""

from typing import Callable, Optional

from gateway.session_context import get_session_env

# (session_key, event, payload) sink, installed by the desktop gateway.
_emit: Optional[Callable[[str, str, dict], None]] = None


def set_emitter(fn: Optional[Callable[[str, str, dict], None]]) -> None:
    """Install (or clear) the renderer-event sink. Called by the desktop gateway."""
    global _emit
    _emit = fn


def available() -> bool:
    """True when running under the desktop app (an emitter is wired)."""
    return _emit is not None


def emit(event: str, payload: dict) -> bool:
    """Route ``event`` to the window that owns the current turn.

    Returns ``False`` when no emitter is wired (i.e. not the desktop app).
    """
    fn = _emit
    if fn is None:
        return False
    fn(get_session_env("ANAKOT_SESSION_KEY", ""), event, payload)
    return True
