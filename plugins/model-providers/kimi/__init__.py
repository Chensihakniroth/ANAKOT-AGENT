"""Kimi (Moonshot) provider profile.

Kimi exposes native server-side thinking. Reasoning configuration is
expressed as ``extra_body.thinking`` (enabled/disabled) plus a top-level
``reasoning_effort`` parameter, rather than the OpenRouter-style
``extra_body.reasoning`` block.
"""

from typing import Any

from providers import register_provider
from providers.base import OMIT_TEMPERATURE, ProviderProfile


class KimiProfile(ProviderProfile):
    """Kimi / Moonshot — server-managed thinking, reasoning_effort top-level."""

    def build_api_kwargs_extras(
        self,
        *,
        reasoning_config: dict | None = None,
        **context: Any,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        enabled = True
        effort = "medium"
        if reasoning_config:
            enabled = reasoning_config.get("enabled", True)
            effort = reasoning_config.get("effort", "medium")

        extra_body: dict[str, Any] = {}
        top_level: dict[str, Any] = {}
        if enabled:
            extra_body["thinking"] = {"type": "enabled"}
            top_level["reasoning_effort"] = effort
        else:
            extra_body["thinking"] = {"type": "disabled"}
        return extra_body, top_level


kimi = KimiProfile(
    name="kimi-coding",
    aliases=("kimi", "moonshot"),
    env_vars=("MOONSHOT_API_KEY",),
    display_name="Kimi",
    description="Kimi (Moonshot) — coding models with native thinking",
    base_url="https://api.moonshot.com/v1",
    default_max_tokens=32000,
    fixed_temperature=OMIT_TEMPERATURE,
)
register_provider(kimi)

kimi_cn = KimiProfile(
    name="kimi-coding-cn",
    aliases=(),
    env_vars=("KIMI_CN_API_KEY",),
    display_name="Kimi (China)",
    description="Kimi China endpoint (moonshot.cn)",
    base_url="https://api.moonshot.cn/v1",
    default_max_tokens=32000,
    fixed_temperature=OMIT_TEMPERATURE,
)
register_provider(kimi_cn)
