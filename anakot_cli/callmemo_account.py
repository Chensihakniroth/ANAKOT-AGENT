"""Stubs for callmemo Portal account / subscription — removed in Anakot fork.

All functions return safe no-op defaults. The callmemo Portal was a Hermes
Agent / Nous Research service that does not exist in the Anakot fork. These
stubs keep the remaining import sites (auth, status, setup, etc.) compiling
without the ~1 800 lines of dead OAuth / entitlement / billing code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, Literal, Optional, Set


# ── Re-exported data classes (kept so external importers still work) ────────

NousAccountInfoSource = Literal["jwt", "account_api", "inference_key", "none", "error"]

TOOL_COVERAGE_CATEGORIES = (
    "firecrawl",
    "fal",
    "fal-video",
    "openai-audio",
    "browser-use",
    "modal",
)


@dataclass(frozen=True)
class NousPortalSubscriptionInfo:
    plan: Optional[str] = None
    tier: Optional[int] = None
    monthly_charge: Optional[float] = None
    monthly_credits: Optional[float] = None
    current_period_end: Optional[str] = None
    credits_remaining: Optional[float] = None
    rollover_credits: Optional[float] = None


@dataclass(frozen=True)
class NousPaidServiceAccessInfo:
    allowed: Optional[bool] = None
    paid_access: Optional[bool] = None
    reason: Optional[str] = None
    organisation_id: Optional[str] = None
    effective_at_ms: Optional[int] = None
    has_active_subscription: Optional[bool] = None
    active_subscription_is_paid: Optional[bool] = None
    subscription_tier: Optional[int] = None
    subscription_monthly_charge: Optional[float] = None
    subscription_credits_remaining: Optional[float] = None
    purchased_credits_remaining: Optional[float] = None
    total_usable_credits: Optional[float] = None


@dataclass(frozen=True)
class NousToolAccessInfo:
    enabled: bool = False
    coverage: dict[str, bool] = field(default_factory=dict)


@dataclass(frozen=True)
class NousPortalAccountInfo:
    logged_in: bool = False
    source: NousAccountInfoSource = "none"
    fresh: bool = False
    user_id: Optional[str] = None
    org_id: Optional[str] = None
    client_id: Optional[str] = None
    product_id: Optional[str] = None
    nous_client: Optional[str] = None
    portal_base_url: Optional[str] = None
    inference_base_url: Optional[str] = None
    inference_credential_present: bool = False
    credential_source: Optional[str] = None
    expires_at: Optional[datetime] = None
    email: Optional[str] = None
    privy_did: Optional[str] = None
    subscription: Optional[NousPortalSubscriptionInfo] = None
    paid_service_access: Optional[bool] = None
    paid_service_access_info: Optional[NousPaidServiceAccessInfo] = None
    tool_access: Optional[NousToolAccessInfo] = None
    raw_claims: Optional[dict[str, Any]] = None
    raw_account: Optional[dict[str, Any]] = None
    error: Optional[str] = None

    @property
    def is_paid(self) -> bool:
        return self.paid_service_access is True

    @property
    def is_free_tier(self) -> bool:
        return self.paid_service_access is False

    @property
    def tool_gateway_entitled(self) -> bool:
        return False

    def tool_gateway_entitled_for(self, category: str) -> bool:
        return False


# ── callmemo_account.py functions ───────────────────────────────────────────

def callmemo_portal_billing_url(
    account_info: Optional[NousPortalAccountInfo] = None,
) -> str:
    return "https://portal.callmemo.ai/billing"


def format_callmemo_portal_entitlement_message(
    account_info: Optional[NousPortalAccountInfo],
    *,
    capability: str = "this feature",
    include_refresh_hint: bool = True,
    coverage_category: Optional[str] = None,
) -> Optional[str]:
    return None


def reset_callmemo_portal_account_info_cache() -> None:
    pass


def get_callmemo_portal_account_info(
    *,
    force_fresh: bool = False,
    min_jwt_ttl_seconds: int = 60,
) -> NousPortalAccountInfo:
    return NousPortalAccountInfo(logged_in=False, source="none", fresh=False)


# ── Internal helpers (kept for test compatibility) ──────────────────────────

def _coerce_str(value: Any) -> Optional[str]:
    if isinstance(value, str) and value:
        return value
    return None


def _coerce_bool(value: Any) -> Optional[bool]:
    return value if isinstance(value, bool) else None


def _coerce_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _subscription_from_payload(value: Any) -> Optional[NousPortalSubscriptionInfo]:
    if not isinstance(value, dict):
        return None
    return NousPortalSubscriptionInfo(
        plan=_coerce_str(value.get("plan")),
        tier=_coerce_int(value.get("tier")),
        monthly_charge=_coerce_float(value.get("monthly_charge")),
        monthly_credits=_coerce_float(value.get("monthly_credits")),
        current_period_end=_coerce_str(value.get("current_period_end")),
        credits_remaining=_coerce_float(value.get("credits_remaining")),
        rollover_credits=_coerce_float(value.get("rollover_credits")),
    )
