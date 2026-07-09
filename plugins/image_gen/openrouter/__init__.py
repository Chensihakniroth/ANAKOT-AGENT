"""OpenRouter image generation backend.

Routes image generation through the user's OpenRouter API key, hitting the
OpenAI-compatible ``/api/v1/images/generations`` endpoint. OpenRouter supports
Google Gemini image models and OpenAI GPT image models, all billed at
per-use rates (many under $0.0001/image).

Model catalog
-------------
OpenRouter supports whatever image-generation models its upstream providers
make available. This plugin pre-registers the most common/reliable ones:

    google/gemini-2.5-flash-image     ~$0.0000003/image  (fast, cheap)
    google/gemini-3-pro-image         ~$0.000002/image   (higher quality)
    openai/gpt-5.4-image-2            OpenAI GPT image
    google/gemini-3.1-flash-image     mid-range Gemini
    openai/gpt-5-image-mini           budget GPT image
    openai/gpt-5-image                full GPT image

The active model follows standard precedence:

1. ``OPENROUTER_IMAGE_MODEL`` env var
2. ``image_gen.openrouter.model`` in ``config.yaml``
3. ``image_gen.model`` in ``config.yaml`` (when matching our catalog)
4. :data:`DEFAULT_MODEL`
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

import requests

from agent.image_gen_provider import (
    DEFAULT_ASPECT_RATIO,
    ImageGenProvider,
    error_response,
    resolve_aspect_ratio,
    save_b64_image,
    success_response,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model catalog
# ---------------------------------------------------------------------------
# OpenRouter passes the model string through to the upstream provider;
# we list well-known image-capable models here so the tool picker and
# config resolution work the same way as every other backend.

_MODELS: Dict[str, Dict[str, Any]] = {
    "google/gemini-2.5-flash-image": {
        "display": "Gemini 2.5 Flash (Image)",
        "speed": "~5-10s",
        "strengths": "Fast, cheapest — ~$0.0000003/image",
        "price": "~$0.0000003",
    },
    "google/gemini-3.1-flash-image": {
        "display": "Gemini 3.1 Flash (Image)",
        "speed": "~5-10s",
        "strengths": "Mid-range Gemini image model",
        "price": "~$0.0000005",
    },
    "google/gemini-3-pro-image": {
        "display": "Gemini 3 Pro (Image)",
        "speed": "~15-30s",
        "strengths": "Highest quality, best prompt adherence",
        "price": "~$0.000002",
    },
    "openai/gpt-5.4-image-2": {
        "display": "GPT 5.4 Image 2",
        "speed": "~10-20s",
        "strengths": "OpenAI GPT image generation",
        "price": "varies",
    },
    "openai/gpt-5-image-mini": {
        "display": "GPT 5 Image Mini",
        "speed": "~5-10s",
        "strengths": "Budget GPT image tier",
        "price": "varies",
    },
    "openai/gpt-5-image": {
        "display": "GPT 5 Image",
        "speed": "~10-20s",
        "strengths": "Full GPT image generation",
        "price": "varies",
    },
}

DEFAULT_MODEL = "google/gemini-2.5-flash-image"

# OpenRouter base URL
_BASE_URL = "https://openrouter.ai/api/v1"


def _load_openrouter_config() -> Dict[str, Any]:
    """Read ``image_gen.openrouter`` from config.yaml."""
    try:
        from anakot_cli.config import load_config

        cfg = load_config()
        section = cfg.get("image_gen") if isinstance(cfg, dict) else None
        or_section = section.get("openrouter") if isinstance(section, dict) else None
        return or_section if isinstance(or_section, dict) else {}
    except Exception as exc:
        logger.debug("Could not load image_gen.openrouter config: %s", exc)
        return {}


def _resolve_model() -> Tuple[str, Dict[str, Any]]:
    """Decide which model to use and return ``(model_id, meta)``."""
    env_override = os.environ.get("OPENROUTER_IMAGE_MODEL")
    if env_override and env_override in _MODELS:
        return env_override, _MODELS[env_override]

    cfg = _load_openrouter_config()
    candidate = cfg.get("model") if isinstance(cfg.get("model"), str) else None
    if candidate and candidate in _MODELS:
        return candidate, _MODELS[candidate]

    # Fallback: check image_gen.model (top-level)
    try:
        from anakot_cli.config import load_config

        cfg = load_config()
        section = cfg.get("image_gen") if isinstance(cfg, dict) else None
        top = section.get("model") if isinstance(section, dict) else None
        if isinstance(top, str) and top in _MODELS:
            return top, _MODELS[top]
    except Exception:
        pass

    return DEFAULT_MODEL, _MODELS[DEFAULT_MODEL]


def _get_api_key() -> Optional[str]:
    """Return the OpenRouter API key from .env / os.environ."""
    try:
        from anakot_cli.config import get_env_value as _gev
        val = _gev("OPENROUTER_API_KEY")
        if val and val.strip():
            return val.strip()
    except Exception:
        pass
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    return key if key else None


# ---------------------------------------------------------------------------
# Aspect-ratio → size mapping
# ---------------------------------------------------------------------------

_SIZES: Dict[str, str] = {
    "landscape": "1536x1024",
    "square": "1024x1024",
    "portrait": "1024x1536",
}


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


class OpenRouterImageGenProvider(ImageGenProvider):
    """OpenRouter image generation backend."""

    @property
    def name(self) -> str:
        return "openrouter"

    @property
    def display_name(self) -> str:
        return "OpenRouter"

    def is_available(self) -> bool:
        api_key = _get_api_key()
        if not api_key:
            return False
        # Quick validation — try a non-image API call to check key validity
        # without spending credits. If the key is bad, early-out.
        return True

    def list_models(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": model_id,
                "display": meta["display"],
                "speed": meta.get("speed", ""),
                "strengths": meta.get("strengths", ""),
                "price": meta.get("price", "varies"),
            }
            for model_id, meta in _MODELS.items()
        ]

    def default_model(self) -> Optional[str]:
        return DEFAULT_MODEL

    def get_setup_schema(self) -> Dict[str, Any]:
        return {
            "name": "OpenRouter",
            "badge": "paid",
            "tag": "Gemini + GPT image models via OpenRouter API",
            "env_vars": [
                {
                    "key": "OPENROUTER_API_KEY",
                    "prompt": "OpenRouter API key",
                    "url": "https://openrouter.ai/keys",
                },
            ],
        }

    def generate(
        self,
        prompt: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        prompt = (prompt or "").strip()
        aspect = resolve_aspect_ratio(aspect_ratio)

        if not prompt:
            return error_response(
                error="Prompt is required and must be a non-empty string",
                error_type="invalid_argument",
                provider="openrouter",
                aspect_ratio=aspect,
            )

        api_key = _get_api_key()
        if not api_key:
            return error_response(
                error=(
                    "OPENROUTER_API_KEY not set. Run `anakot tools` → Image "
                    "Generation → OpenRouter to configure, or `anakot setup` "
                    "to add the key."
                ),
                error_type="auth_required",
                provider="openrouter",
                aspect_ratio=aspect,
            )

        model_id, meta = _resolve_model()
        size = _SIZES.get(aspect, _SIZES["square"])

        # Build payload — OpenAI-compatible /images/generations format
        payload: Dict[str, Any] = {
            "model": model_id,
            "prompt": prompt,
            "size": size,
            "n": 1,
        }

        # Pass through reference_image_urls if provided (for pet hatching
        # and other reference-based workflows). Not all models support this;
        # OpenRouter will return an error if the model rejects the param.
        ref_urls = kwargs.get("reference_image_urls") or kwargs.get("reference_images")
        if ref_urls and isinstance(ref_urls, list) and ref_urls:
            # Some OpenRouter models may support image editing via the
            # OpenAI-compatible image format. Pass it through.
            if len(ref_urls) > 0:
                payload["image"] = ref_urls[0]

        # OpenRouter-specific headers
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://anakot.app",
            "X-Title": "Anakot Agent",
        }

        try:
            resp = requests.post(
                f"{_BASE_URL}/images/generations",
                headers=headers,
                json=payload,
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.HTTPError as exc:
            body = ""
            try:
                body = exc.response.text[:500]
            except Exception:
                pass
            logger.debug("OpenRouter image generation HTTP error: %s %s", exc, body)
            return error_response(
                error=f"OpenRouter image generation failed: {exc}",
                error_type="api_error",
                provider="openrouter",
                model=model_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )
        except requests.exceptions.RequestException as exc:
            logger.debug("OpenRouter image generation request failed: %s", exc)
            return error_response(
                error=f"OpenRouter request failed: {exc}",
                error_type="network_error",
                provider="openrouter",
                model=model_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )
        except Exception as exc:
            logger.debug("OpenRouter image generation unexpected error", exc_info=True)
            return error_response(
                error=f"OpenRouter image generation error: {exc}",
                error_type="unexpected_error",
                provider="openrouter",
                model=model_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        result_data = data.get("data") if isinstance(data, dict) else None
        if not result_data or not isinstance(result_data, list) or len(result_data) == 0:
            err = (data or {}).get("error", {}).get("message", "empty response") if isinstance(data, dict) else "no data"
            return error_response(
                error=f"OpenRouter returned no image data: {err}",
                error_type="empty_response",
                provider="openrouter",
                model=model_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        first = result_data[0]
        b64 = first.get("b64_json") if isinstance(first, dict) else None
        url = first.get("url") if isinstance(first, dict) else None
        revised_prompt = first.get("revised_prompt") if isinstance(first, dict) else None

        if b64:
            try:
                saved_path = save_b64_image(b64, prefix=f"openrouter_{model_id.replace('/', '_')}")
            except Exception as exc:
                return error_response(
                    error=f"Could not save image to cache: {exc}",
                    error_type="io_error",
                    provider="openrouter",
                    model=model_id,
                    prompt=prompt,
                    aspect_ratio=aspect,
                )
            image_ref = str(saved_path)
        elif url:
            try:
                saved_path = save_url_image(url, prefix=f"openrouter_{model_id.replace('/', '_')}")
            except Exception as exc:
                logger.warning(
                    "OpenRouter image URL %s could not be cached (%s); falling back to bare URL.",
                    url,
                    exc,
                )
                image_ref = url
            else:
                image_ref = str(saved_path)
        else:
            return error_response(
                error="OpenRouter response contained neither b64_json nor URL",
                error_type="empty_response",
                provider="openrouter",
                model=model_id,
                prompt=prompt,
                aspect_ratio=aspect,
            )

        extra: Dict[str, Any] = {"size": size}
        if revised_prompt:
            extra["revised_prompt"] = revised_prompt

        return success_response(
            image=image_ref,
            model=model_id,
            prompt=prompt,
            aspect_ratio=aspect,
            provider="openrouter",
            extra=extra,
        )


# ---------------------------------------------------------------------------
# Plugin entry point
# ---------------------------------------------------------------------------


def register(ctx) -> None:
    """Plugin entry point — wire ``OpenRouterImageGenProvider`` into the registry."""
    ctx.register_image_gen_provider(OpenRouterImageGenProvider())
