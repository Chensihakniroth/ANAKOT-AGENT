"""Tests for the callmemo-Anakot-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"anakot"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``anakot-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "anakot" tag namespace.

``is_nous_anakot_non_agentic`` should only match the actual callmemo
Anakot-3 / Anakot-4 chat family.
"""

from __future__ import annotations

import pytest

from anakot_cli.model_switch import (
    _ANAKOT_MODEL_WARNING,
    _check_anakot_model_warning,
    is_nous_anakot_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "callmemo/Anakot-3-Llama-3.1-70B",
        "callmemo/Anakot-3-Llama-3.1-405B",
        "anakot-3",
        "Anakot-3",
        "anakot-4",
        "anakot-4-405b",
        "anakot_4_70b",
        "openrouter/anakot3:70b",
        "openrouter/nousresearch/anakot-4-405b",
        "callmemo/Anakot3",
        "anakot-3.1",
    ],
)
def test_matches_real_nous_anakot_chat_models(model_name: str) -> None:
    assert is_nous_anakot_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as callmemo Anakot 3/4"
    )
    assert _check_anakot_model_warning(model_name) == _ANAKOT_MODEL_WARNING


@pytest.mark.parametrize(
    "model_name",
    [
        # Kyle's local Modelfile — qwen3:14b under a custom tag
        "anakot-brain:qwen3-14b-ctx16k",
        "anakot-brain:qwen3-14b-ctx32k",
        "anakot-honcho:qwen3-8b-ctx8k",
        # Plain unrelated models
        "qwen3:14b",
        "qwen3-coder:30b",
        "qwen2.5:14b",
        "claude-opus-4-6",
        "anthropic/claude-sonnet-4.5",
        "gpt-5",
        "openai/gpt-4o",
        "google/gemini-2.5-flash",
        "deepseek-chat",
        # Non-chat Anakot models we don't warn about
        "anakot-llm-2",
        "anakot2-pro",
        "nous-anakot-2-mistral",
        # Edge cases
        "",
        "anakot",  # bare "anakot" isn't the 3/4 family
        "anakot-brain",
        "brain-anakot-3-impostor",  # "3" not preceded by /: boundary
    ],
)
def test_does_not_match_unrelated_models(model_name: str) -> None:
    assert not is_nous_anakot_non_agentic(model_name), (
        f"expected {model_name!r} NOT to be flagged as callmemo Anakot 3/4"
    )
    assert _check_anakot_model_warning(model_name) == ""


def test_none_like_inputs_are_safe() -> None:
    assert is_nous_anakot_non_agentic("") is False
    # Defensive: the helper shouldn't crash on None-ish falsy input either.
    assert _check_anakot_model_warning("") == ""
