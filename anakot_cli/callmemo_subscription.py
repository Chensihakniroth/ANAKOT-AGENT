"""Stubs for callmemo subscription managed-tool capabilities — removed in Anakot fork.

All functions return safe no-op defaults. The callmemo Portal Tool Gateway was
a Hermes Agent / Nous Research managed-backend service. Anakot users configure
their own provider API keys (OpenRouter, FAL, Firecrawl, etc.) directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Optional, Set


MANAGED_FEATURE_COVERAGE_CATEGORY: Dict[str, str] = {
    "web": "firecrawl",
    "image_gen": "fal",
    "video_gen": "fal-video",
    "tts": "openai-audio",
    "browser": "browser-use",
    "modal": "modal",
}


@dataclass(frozen=True)
class NousFeatureState:
    key: str
    label: str
    included_by_default: bool
    available: bool
    active: bool
    managed_by_nous: bool
    direct_override: bool
    toolset_enabled: bool
    current_provider: str = ""
    explicit_configured: bool = False


@dataclass(frozen=True)
class NousSubscriptionFeatures:
    subscribed: bool
    nous_auth_present: bool
    provider_is_nous: bool
    features: Dict[str, NousFeatureState]
    account_info: Optional[object] = None

    @property
    def web(self) -> NousFeatureState:
        return self.features["web"]

    @property
    def image_gen(self) -> NousFeatureState:
        return self.features["image_gen"]

    @property
    def tts(self) -> NousFeatureState:
        return self.features["tts"]

    @property
    def browser(self) -> NousFeatureState:
        return self.features["browser"]

    @property
    def video_gen(self) -> NousFeatureState:
        return self.features["video_gen"]

    @property
    def modal(self) -> NousFeatureState:
        return self.features["modal"]

    def items(self) -> Iterable[NousFeatureState]:
        for key in ("web", "image_gen", "video_gen", "tts", "browser", "modal"):
            yield self.features[key]


def get_callmemo_subscription_features(
    config: Optional[Dict[str, object]] = None,
    *,
    force_fresh: bool = False,
) -> NousSubscriptionFeatures:
    from anakot_cli.callmemo_account import NousPortalAccountInfo

    return NousSubscriptionFeatures(
        subscribed=False,
        nous_auth_present=False,
        provider_is_nous=False,
        features={
            "web": NousFeatureState(key="web", label="Web tools", included_by_default=True, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
            "image_gen": NousFeatureState(key="image_gen", label="Image generation", included_by_default=True, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
            "video_gen": NousFeatureState(key="video_gen", label="Video generation", included_by_default=False, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
            "tts": NousFeatureState(key="tts", label="OpenAI TTS", included_by_default=True, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
            "browser": NousFeatureState(key="browser", label="Browser automation", included_by_default=True, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
            "modal": NousFeatureState(key="modal", label="Modal execution", included_by_default=False, available=False, active=False, managed_by_nous=False, direct_override=False, toolset_enabled=False),
        },
        account_info=NousPortalAccountInfo(logged_in=False, source="none", fresh=False),
    )


def apply_nous_managed_defaults(
    config: Dict[str, object],
    *,
    enabled_toolsets: Optional[Iterable[str]] = None,
    force_fresh: bool = False,
) -> set[str]:
    return set()


def get_gateway_eligible_tools(
    config: Optional[Dict[str, object]] = None,
    *,
    force_fresh: bool = False,
) -> tuple[list[str], list[str], list[str]]:
    return [], [], []


def apply_gateway_defaults(
    config: Dict[str, object],
    tool_keys: list[str],
) -> set[str]:
    return set()


def prompt_enable_tool_gateway(
    config: Dict[str, object],
    *,
    force_fresh: bool = True,
) -> set[str]:
    return set()


def ensure_callmemo_portal_access(
    *,
    capability: str = "the callmemo Tool Gateway",
    coverage_category: Optional[str] = None,
) -> bool:
    return False
