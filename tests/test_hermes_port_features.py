"""Comprehensive unit tests for ported Hermes-to-Anakot features:

1. Context breakdown & glyph gauge (/context)
2. Foreign session parser, browser, and SessionDB import (/sessions import)
3. Learning journey timeline renderer & /learn meta-prompt
"""

import json
import os
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from agent.context_breakdown import (
    compute_session_context_breakdown,
    render_context_grid,
    render_context_category_lines,
    render_context_breakdown_lines,
)
from agent.learn_prompt import build_learn_prompt
from anakot_cli.foreign_sessions import (
    parse_claude_session,
    parse_codex_session,
    parse_markdown_transcript,
    detect_and_parse,
    import_foreign_session,
    derive_session_title,
)
from anakot_cli.foreign_sessions_browser import (
    discover_foreign_sessions,
    preview_foreign_session,
    resolve_handle_to_path,
)
from anakot_cli.journey import render_timeline, handle_journey_subcommand
from anakot_state import SessionDB


# ── Feature 1: Context Breakdown Tests ───────────────────────────────

def test_context_breakdown_computation():
    mock_agent = MagicMock()
    mock_agent.model = "claude-3-5-sonnet"
    mock_agent.system_prompt = "You are Anakot Agent, an autonomous coding agent."
    mock_agent.platform = "cli"
    mock_agent.load_soul_identity = False
    mock_agent.skip_context_files = True
    mock_agent.valid_tool_names = set()
    mock_agent._kanban_worker_guidance = None
    mock_agent._memory_store = None
    mock_agent._memory_manager = None
    mock_agent.provider = "anthropic"
    mock_agent.pass_session_id = False
    mock_agent._cached_system_prompt = {
        "stable": "You are Anakot Agent, an autonomous coding agent.",
        "context": "",
        "volatile": "",
    }
    mock_agent.context_compressor = MagicMock()
    mock_agent.context_compressor.context_length = 200000
    mock_agent.context_compressor.last_prompt_tokens = 1500
    mock_agent.tools = []
    mock_agent.conversation_history = [
        {"role": "user", "content": "Hello, write a script."},
        {"role": "assistant", "content": "Sure, here is the script."},
    ]

    breakdown = compute_session_context_breakdown(mock_agent, mock_agent.conversation_history)
    assert breakdown["context_max"] == 200000
    assert "categories" in breakdown
    cat_ids = [c["id"] for c in breakdown["categories"]]
    assert "system_prompt" in cat_ids
    assert "conversation" in cat_ids

    grid = render_context_grid(breakdown)
    assert len(grid) > 0
    assert len(grid) == 5  # 5 rows of 20 columns

    lines = render_context_breakdown_lines(breakdown)
    assert any("Context window:" in line for line in lines)
    assert any("Estimated usage" in line for line in lines)


# ── Feature 4: Learning Journey & Skill Synthesis Tests ───────────────

def test_learn_prompt_builder():
    prompt = build_learn_prompt("Build an automated deployment skill for Cloudflare Workers")
    assert "reusable skill" in prompt.lower()
    assert "Cloudflare Workers" in prompt
    assert "SKILL.md" in prompt
    assert "yaml" in prompt.lower()


def test_journey_timeline_empty():
    lines = render_timeline({"nodes": [], "stats": {}})
    assert any("No learned skills or memories yet" in line for line in lines)
    output = handle_journey_subcommand("list")
    assert isinstance(output, list)


# ── Feature 3: Foreign Session Import Tests ──────────────────────────

def test_parse_claude_session():
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
        # Claude Code format entries
        f.write(json.dumps({"type": "user", "text": "Fix the bug in main.py"}) + "\n")
        f.write(json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": "I inspected main.py and fixed it."}]}}) + "\n")
        path = Path(f.name)

    try:
        msgs = parse_claude_session(path)
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert "Fix the bug" in msgs[0]["content"]
        assert msgs[1]["role"] == "assistant"
        assert "inspected main.py" in msgs[1]["content"]
    finally:
        path.unlink(missing_ok=True)


def test_parse_codex_session():
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
        f.write(json.dumps({"item": {"role": "user", "content": [{"type": "text", "text": "Write a unit test"}]}}) + "\n")
        f.write(json.dumps({"item": {"role": "assistant", "content": "Here is the pytest function"}}) + "\n")
        path = Path(f.name)

    try:
        msgs = parse_codex_session(path)
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert "Write a unit test" in msgs[0]["content"]
        assert msgs[1]["role"] == "assistant"
        assert "pytest function" in msgs[1]["content"]
    finally:
        path.unlink(missing_ok=True)


def test_parse_markdown_transcript():
    md_content = """# User
Can you optimize this query?

# Assistant
Certainly! Here is an indexed version of your SELECT query.

# User
Thanks, that worked.
"""
    msgs = parse_markdown_transcript(md_content)
    assert len(msgs) == 3
    assert msgs[0]["role"] == "user"
    assert "optimize this query" in msgs[0]["content"]
    assert msgs[1]["role"] == "assistant"
    assert "indexed version" in msgs[1]["content"]
    assert msgs[2]["role"] == "user"


def test_import_foreign_session_into_db():
    import shutil
    tmpdir = tempfile.mkdtemp()
    db = None
    try:
        db_path = Path(tmpdir) / "state.db"
        db = SessionDB(db_path=db_path)

        # Create a sample foreign session JSONL file
        sample_file = Path(tmpdir) / "claude_project.jsonl"
        with open(sample_file, "w", encoding="utf-8") as f:
            f.write(json.dumps({"type": "user", "text": "First turn from Claude Code"}) + "\n")
            f.write(json.dumps({"type": "assistant", "text": "Response from Claude Code"}) + "\n")

        res = import_foreign_session(
            file_path=sample_file,
            db=db,
            source="claude_code",
        )

        assert res["session_id"].startswith("imp_")
        assert res["message_count"] == 2
        assert "First turn" in res["title"]

        # Verify it was saved in SessionDB
        messages = db.get_messages(res["session_id"])
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert "First turn" in messages[0]["content"]
        assert messages[1]["role"] == "assistant"
    finally:
        if db:
            db.close()
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_browser_discovery_and_preview():
    import shutil
    tmpdir = tempfile.mkdtemp()
    try:
        root = Path(tmpdir) / "transcripts"
        root.mkdir()
        transcript = root / "chat.jsonl"
        with open(transcript, "w", encoding="utf-8") as f:
            f.write(json.dumps({"role": "user", "content": "How to deploy to Kubernetes?"}) + "\n")
            f.write(json.dumps({"role": "assistant", "content": "Use kubectl apply -f deployment.yaml"}) + "\n")

        discovered = discover_foreign_sessions(roots=[root])
        assert len(discovered) == 1
        meta = discovered[0]
        assert meta.message_count == 2
        assert "Kubernetes" in meta.title

        # Preview session by handle
        preview = preview_foreign_session(meta.handle, roots=[root])
        assert preview["total_turns"] == 2
        assert len(preview["preview_turns"]) == 2
        assert preview["preview_turns"][0]["role"] == "user"

        # Resolve handle
        resolved = resolve_handle_to_path(meta.handle, roots=[root])
        assert resolved is not None
        assert resolved.resolve() == transcript.resolve()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
