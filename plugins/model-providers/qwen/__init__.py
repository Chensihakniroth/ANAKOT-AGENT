"""Qwen provider profile (OAuth / external)."""

from typing import Any

from providers import register_provider
from providers.base import ProviderProfile


class QwenProfile(ProviderProfile):
    """Qwen — vision high-res extra_body + session metadata top-level."""

    def build_extra_body(self, *, session_id: str | None = None, **context: Any) -> dict[str, Any]:
        return {"vl_high_resolution_images": True}

    def prepare_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for m in messages:
            m = dict(m)
            content = m.get("content")
            if isinstance(content, str):
                m["content"] = [{"type": "text", "text": content}]
            if (
                isinstance(m.get("content"), list)
                and m["content"]
                and m.get("role") != "user"
            ):
                last = dict(m["content"][-1])
                last["cache_control"] = {"type": "ephemeral"}
                m["content"][-1] = last
            out.append(m)
        return out

    def build_api_kwargs_extras(
        self,
        *,
        reasoning_config: dict | None = None,
        **context: Any,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        top_level: dict[str, Any] = {}
        meta = context.get("qwen_session_metadata")
        if meta is not None:
            top_level["metadata"] = meta
        return {}, top_level


qwen = QwenProfile(
    name="qwen-oauth",
    aliases=("qwen", "qwen-portal"),
    env_vars=("QWEN_API_KEY",),
    display_name="Qwen",
    description="Qwen (Alibaba) — OAuth / external provider",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_max_tokens=65536,
    auth_type="oauth_external",
)
register_provider(qwen)
