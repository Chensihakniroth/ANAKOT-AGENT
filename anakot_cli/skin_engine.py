"""Anakot CLI theme engine.

Hardcoded Hermes Agent CLI visual style — clean, minimal, no ASCII art.
Keeps the SkinConfig / get_active_skin() API so consumers don't break.

The old YAML skin system is gone. Colors are defined here as constants.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# =============================================================================
# Hermes Agent CLI palette — dark background, cyan/blue accents
# =============================================================================

_PALETTE: Dict[str, str] = {
    # Banner / header
    "banner_border": "#3c3c3c",
    "banner_title": "#e6edf3",
    "banner_accent": "#58a6ff",
    "banner_dim": "#768390",
    "banner_text": "#c9d1d9",
    # General UI
    "ui_accent": "#58a6ff",
    "ui_label": "#58a6ff",
    "ui_ok": "#3fb950",
    "ui_error": "#f85149",
    "ui_warn": "#d29922",
    # Prompt / input
    "prompt": "#c9d1d9",
    "input_rule": "#3c3c3c",
    # Response box
    "response_border": "#58a6ff",
    # Status bar
    "status_bar_bg": "#0d1117",
    "status_bar_text": "#c9d1d9",
    "status_bar_strong": "#e6edf3",
    "status_bar_dim": "#768390",
    "status_bar_good": "#3fb950",
    "status_bar_warn": "#d29922",
    "status_bar_bad": "#db6d28",
    "status_bar_critical": "#f85149",
    # Session label
    "session_label": "#d29922",
    "session_border": "#768390",
    # TUI
    "voice_status_bg": "#0d1117",
    "selection_bg": "#1f2937",
    "completion_menu_bg": "#0d1117",
    "completion_menu_current_bg": "#1f2937",
    "completion_menu_meta_bg": "#0d1117",
    "completion_menu_meta_current_bg": "#1f2937",
    # Diff
    "diff_added": "#3fb950",
    "diff_removed": "#f85149",
    # Misc
    "text_inverse": "#0d1117",
    "bg_panel": "#0d1117",
    "bg_element": "#161b22",
    "border_active": "#58a6ff",
}

# Default branding — Hermes Agent style
_DEFAULT_BRANDING: Dict[str, str] = {
    "agent_name": "Anakot",
    "welcome": "Anakot Agent — type your message or /help for commands.",
    "goodbye": "Goodbye!",
    "response_label": " Anakot ",
    "prompt_symbol": ">",
    "help_header": "Available Commands",
}

# Default spinner — clean dots
_DEFAULT_SPINNER: Dict[str, Any] = {
    "waiting_faces": ["·", "•"],
    "thinking_faces": ["·", "•"],
    "thinking_verbs": ["thinking"],
    "wings": [],
}


# =============================================================================
# Skin data structure
# =============================================================================

@dataclass
class SkinConfig:
    """Complete skin configuration — kept for API compatibility."""
    name: str = "hermes"
    description: str = "Hermes Agent CLI — clean terminal assistant"
    colors: Dict[str, str] = field(default_factory=lambda: dict(_PALETTE))
    spinner: Dict[str, Any] = field(default_factory=lambda: dict(_DEFAULT_SPINNER))
    branding: Dict[str, str] = field(default_factory=lambda: dict(_DEFAULT_BRANDING))
    tool_prefix: str = "│"
    tool_emojis: Dict[str, str] = field(default_factory=dict)
    banner_logo: str = ""
    banner_hero: str = ""

    def get_color(self, key: str, fallback: str = "") -> str:
        return self.colors.get(key, fallback)

    def get_spinner_wings(self) -> List[Tuple[str, str]]:
        return []

    def get_branding(self, key: str, fallback: str = "") -> str:
        return self.branding.get(key, fallback)


# =============================================================================
# Active skin (singleton, immutable — no YAML, no user skins)
# =============================================================================

_active_skin: SkinConfig = SkinConfig()
_active_skin_name: str = "hermes"


def get_active_skin() -> SkinConfig:
    """Return the active Hermes-style skin config."""
    return _active_skin


def set_active_skin(name: str) -> SkinConfig:
    """No-op — skins are no longer switchable. Returns current."""
    return _active_skin


def get_active_skin_name() -> str:
    return _active_skin_name


def init_skin_from_config(config: dict) -> None:
    """No-op — config display.skin is ignored."""
    pass


# =============================================================================
# Backward-compat stubs (no-op or minimal)
# =============================================================================

def list_skins() -> List[Dict[str, str]]:
    """No-op — returns single hardcoded skin."""
    return [{"name": "hermes", "description": "Hermes Agent CLI", "source": "builtin"}]


def load_skin(name: str) -> SkinConfig:
    """No-op — returns hardcoded Hermes skin."""
    return _active_skin


# =============================================================================
# Convenience helpers (kept for API compat)
# =============================================================================

def get_active_prompt_symbol(fallback: str = "> ") -> str:
    return "> "


def get_active_help_header(fallback: str = "Available Commands") -> str:
    return "Available Commands"


def get_active_goodbye(fallback: str = "Goodbye!") -> str:
    return "Goodbye!"


def get_prompt_toolkit_style_overrides() -> Dict[str, str]:
    """prompt_toolkit style overrides derived from the Hermes palette."""
    skin = _active_skin
    prompt = skin.get_color("prompt", "")
    input_rule = skin.get_color("input_rule", "#3c3c3c")
    title = skin.get_color("banner_title", "#e6edf3")
    text = skin.get_color("banner_text", "#c9d1d9")
    dim = skin.get_color("banner_dim", "#768390")
    label = skin.get_color("ui_label", title)
    warn = skin.get_color("ui_warn", "#d29922")
    error = skin.get_color("ui_error", "#f85149")
    status_bg = skin.get_color("status_bar_bg", "#0d1117")
    status_text = skin.get_color("status_bar_text", text)
    status_strong = skin.get_color("status_bar_strong", title)
    status_dim = skin.get_color("status_bar_dim", dim)
    status_good = skin.get_color("status_bar_good", "#3fb950")
    status_warn = skin.get_color("status_bar_warn", warn)
    status_bad = skin.get_color("status_bar_bad", "#db6d28")
    status_critical = skin.get_color("status_bar_critical", error)
    voice_bg = skin.get_color("voice_status_bg", status_bg)
    menu_bg = skin.get_color("completion_menu_bg", "#0d1117")
    menu_current_bg = skin.get_color("completion_menu_current_bg", "#1f2937")
    menu_meta_bg = skin.get_color("completion_menu_meta_bg", menu_bg)
    menu_meta_current_bg = skin.get_color("completion_menu_meta_current_bg", menu_current_bg)

    return {
        "input-area": "",
        "placeholder": f"{dim} italic",
        "prompt": prompt,
        "prompt-working": f"{dim} italic",
        "hint": f"{dim} italic",
        "status-bar": f"bg:{status_bg} {status_text}",
        "status-bar-strong": f"bg:{status_bg} {status_strong} bold",
        "status-bar-dim": f"bg:{status_bg} {status_dim}",
        "status-bar-good": f"bg:{status_bg} {status_good} bold",
        "status-bar-warn": f"bg:{status_bg} {status_warn} bold",
        "status-bar-bad": f"bg:{status_bg} {status_bad} bold",
        "status-bar-critical": f"bg:{status_bg} {status_critical} bold",
        "input-rule": input_rule,
        "image-badge": f"{label} bold",
        "completion-menu": f"bg:{menu_bg} {text}",
        "completion-menu.completion": f"bg:{menu_bg} {text}",
        "completion-menu.completion.current": f"bg:{menu_current_bg} {title}",
        "completion-menu.meta.completion": f"bg:{menu_meta_bg} {dim}",
        "completion-menu.meta.completion.current": f"bg:{menu_meta_current_bg} {label}",
        "clarify-border": input_rule,
        "clarify-title": f"{title} bold",
        "clarify-question": f"{text} bold",
        "clarify-choice": dim,
        "clarify-selected": f"{title} bold",
        "clarify-active-other": f"{title} italic",
        "clarify-countdown": input_rule,
        "sudo-prompt": f"{error} bold",
        "sudo-border": input_rule,
        "sudo-title": f"{error} bold",
        "sudo-text": text,
        "approval-border": input_rule,
        "approval-title": f"{warn} bold",
        "approval-desc": f"{text} bold",
        "approval-cmd": f"{dim} italic",
        "approval-choice": dim,
        "approval-selected": f"{title} bold",
        "voice-status": f"bg:{voice_bg} {label}",
        "voice-status-recording": f"bg:{voice_bg} {error} bold",
    }
