#!/usr/bin/env python3
"""
Big Pickle Proxy — OpenAI-compatible API that forwards to OpenCode.

Modes:
  cli    — uses `opencode -p` (simpler, stateless, ~2s cold start per request)
  serve  — uses `opencode serve` HTTP API (faster, supports tool calls)
  cloud  — forwards directly to OpenCode cloud API (no local OpenCode, UUID auth)

Usage:
  python proxy.py --port 8000 --mode cli
  python proxy.py --port 8000 --mode serve --serve-port 4096

Tool Calls (serve mode only):
  Set session permissions to deny-all so OpenCode doesn't execute tools locally.
  The proxy captures tool_call events and returns them in OpenAI format.
  Your calling agent executes the tools and sends results in the next request.
"""

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

# Debug mode — set BPP_DEBUG=1 to log request params + response stats to stderr
BPP_DEBUG = os.environ.get("BPP_DEBUG", "") == "1"

# ── Model mapping ──────────────────────────────────────────────────────────

MODEL_ALIASES = {
    # Primary OpenCode-built-in (free) models
    "big-pickle":        "opencode/big-pickle",
    "claude-sonnet-4":   "opencode/claude-sonnet-4",
    "claude-sonnet":     "opencode/claude-sonnet-4",
    "claude-opus-4":     "opencode/claude-opus-4-1",
    "claude-opus":       "opencode/claude-opus-4-1",
    "claude-haiku":      "opencode/claude-haiku-4-5",
    "gpt-5":             "opencode/gpt-5.1",
    "gpt-5-codex":       "opencode/gpt-5.1-codex",
    "gpt-5.2":           "opencode/gpt-5.2",
    "gpt-5.3-codex":     "opencode/gpt-5.3-codex",
    "gpt-5.4":           "opencode/gpt-5.4",
    "gemini-flash":      "opencode/gemini-3-flash",
    "gemini-pro":        "opencode/gemini-3.1-pro",
    # OpenCode Go (bring-your-own-key) models
    "deepseek-v4-flash": "opencode-go/deepseek-v4-flash",
    "deepseek-v4-pro":   "opencode-go/deepseek-v4-pro",
    "kimi-k2.5":         "opencode-go/kimi-k2.5",
    "kimi-k2.6":         "opencode-go/kimi-k2.6",
    "qwen3.7-max":       "opencode-go/qwen3.7-max",
    "glm-5":             "opencode-go/glm-5",
    "mimo-v2.5":         "opencode-go/mimo-v2.5",
}

DEFAULT_MODEL = "opencode/big-pickle"

# ── Cloud API backend ──────────────────────────────────────────────────────

OPENCODE_CLOUD_URL = "https://opencode.ai/zen/v1/chat/completions"

# OpenWebUI rejects SSE chunks above ~16KB. Big Pickle's verbose reasoning
# can produce single chunks of 50KB+. Split at sentence boundaries.
SSE_MAX_CHUNK = 8192


def _split_sse_chunk(line: str) -> list[str]:
    """
    Split an oversized SSE data line into smaller valid chunks.
    Preserves the SSE format: yields 'data: {...}\n\n' lines.
    """
    prefix = ""
    if line.startswith("data: "):
        prefix = "data: "
        json_str = line[6:]
    elif line.startswith("data:"):
        prefix = "data:"
        json_str = line[5:]
    else:
        # Not a data line, pass through as-is
        return [f"{line}\n\n"]

    # Non-data lines (comments, [DONE]) pass through
    if not json_str.strip().startswith("{"):
        return [f"{line}\n\n"]

    # Check if it's small enough
    if len(line) <= SSE_MAX_CHUNK:
        return [f"{line}\n\n"]

    # Parse and split the content field(s)
    try:
        chunk = json.loads(json_str)
    except json.JSONDecodeError:
        return [f"{line}\n\n"]

    # Find the content-bearing field in the delta
    delta = chunk.get("choices", [{}])[0].get("delta", {})
    content = delta.get("content", "")
    reasoning = delta.get("reasoning_content", "")

    # If no oversized content, pass through
    if not content and not reasoning:
        return [f"{line}\n\n"]

    target_field = "reasoning_content" if reasoning else "content"
    text = reasoning or content

    if len(text) <= 2048:
        return [f"{line}\n\n"]

    # Split text at sentence boundaries (~1KB per chunk for streaming feel)
    sentences = _split_text(text, chunk_size=1024)
    if len(sentences) <= 1:
        return [f"{line}\n\n"]

    # Emit multiple chunks with progressive content
    result = []
    for i, sentence in enumerate(sentences):
        new_chunk = json.loads(json_str)  # deep copy
        new_chunk["choices"][0]["delta"] = {
            k: (sentence if k == target_field else v)
            for k, v in delta.items()
        }
        result.append(f"{prefix}{json.dumps(new_chunk)}\n\n")
    return result


def _split_text(text: str, chunk_size: int = 1024) -> list[str]:
    """Split text at sentence boundaries, keeping chunks under chunk_size."""
    import re
    parts = []
    current = ""

    # Split on sentence endings: . ! ? followed by space or newline
    tokens = re.split(r"(?<=[.!?])\s+", text)

    for token in tokens:
        if len(current) + len(token) + 1 <= chunk_size:
            current = (current + " " + token).strip() if current else token
        else:
            if current:
                parts.append(current)
            # If a single sentence is still too big, force-split it
            if len(token) > chunk_size:
                for i in range(0, len(token), chunk_size):
                    parts.append(token[i:i + chunk_size])
                current = ""
            else:
                current = token

    if current:
        parts.append(current)

    return parts if len(parts) > 1 else [text]


def _make_cloud_headers() -> dict:
    """Generate UUID headers for OpenCode cloud API auth."""
    return {
        "Content-Type": "application/json",
        "User-Agent": "opencode/1.0.0",
        "x-opencode-project": str(uuid.uuid4()),
        "x-opencode-session": str(uuid.uuid4()),
        "x-opencode-request": str(uuid.uuid4()),
        "x-opencode-client": "opencode",
    }


def resolve_model(requested: str) -> str:
    """Map user-facing model name to OpenCode provider/model string."""
    return MODEL_ALIASES.get(requested, requested)


def list_known_models() -> list[dict]:
    """Return OpenAI-format model list (static fallback)."""
    models = []
    # Confirmed free models on OpenCode Zen (UUID auth, no API key)
    for model_id in [
        "big-pickle",
        "deepseek-v4-flash-free",
        "nemotron-3-super-free",
        "mimo-v2.5-free",
    ]:
        models.append({
            "id": model_id,
            "object": "model",
            "created": 1718400000,
            "owned_by": "opencode",
        })
    return models


# ── Prompt conversion ──────────────────────────────────────────────────────

def messages_to_prompt(messages: list[dict]) -> str:
    """
    Convert OpenAI messages array to a single prompt string.
    Includes tool calls and tool results inline so OpenCode sees full context.
    """
    parts = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")

        # Handle multimodal content arrays
        if isinstance(content, list):
            texts = [p["text"] for p in content if p.get("type") == "text"]
            content = "\n".join(texts)

        if role == "system":
            parts.append(f"<system>\n{content}\n</system>")

        elif role == "user":
            parts.append(content or "")

        elif role == "assistant":
            text = content or ""
            # Include tool calls in the prompt so OpenCode sees them
            tool_calls = msg.get("tool_calls", [])
            if tool_calls:
                for tc in tool_calls:
                    func = tc.get("function", {})
                    name = func.get("name", "unknown")
                    args = func.get("arguments", "{}")
                    text += (
                        f"\n\n[Assistant called tool: {name} "
                        f"with arguments: {args}]"
                    )
            parts.append(text)

        elif role == "tool":
            tool_id = msg.get("tool_call_id", "unknown")
            result = content or ""
            parts.append(f"[Tool result for {tool_id}:\n{result}]")

        elif role == "function":
            # Legacy function role — treat like tool
            name = msg.get("name", "unknown")
            result = content or ""
            parts.append(f"[Function result for {name}:\n{result}]")

    prompt = "\n\n".join(p for p in parts if p)
    return prompt


# ── Tool-call parsing ──────────────────────────────────────────────────────

def _coerce_arg_value(raw: str) -> Any:
    """Coerce a textual parameter value to a JSON-ish type when possible."""
    s = (raw or "").strip()
    if not s:
        return raw
    try:
        return json.loads(s)
    except Exception:
        return raw


def _build_textual_tool_call(body: str) -> Optional[dict]:
    """Parse one ``<tool_call>...</tool_call>`` body into an OpenAI tool call.

    Recognised inner shapes:
      <function=NAME><parameter=k>v</parameter></function>
      <function=NAME>{"k": "v"}</function>
    Returns None when no usable function name is found.
    """
    name_m = re.search(r"<function=([^>\n]+)>", body)
    if not name_m:
        return None
    name = name_m.group(1).strip()
    if not name:
        return None

    params: dict = {}
    for pm in re.finditer(
        r"<parameter=\s*([^>\n\s]+)\s*>(.*?)</parameter\s*>",
        body, flags=re.IGNORECASE | re.DOTALL,
    ):
        key = pm.group(1).strip()
        params[key] = _coerce_arg_value(pm.group(2))

    if not params:
        # No <parameter> tags — try to interpret everything after the
        # <function=...> tag as a JSON object (possibly with residual
        # markup stripped).
        tail = body[name_m.end():]
        tail_clean = re.sub(r"<[^>]*>", "", tail).strip()
        if tail_clean:
            try:
                parsed = json.loads(tail_clean)
                if isinstance(parsed, dict):
                    params = parsed
            except Exception:
                params = {}

    return {
        "id": f"call_{uuid.uuid4().hex[:16]}",
        "type": "function",
        "function": {
            "name": name,
            "arguments": json.dumps(params, ensure_ascii=False) if params else "{}",
        },
    }


def _textual_tool_calls_from_text(text: str) -> tuple[str, list[dict]]:
    """Extract OpenCode-style textual ``<tool_call>`` blocks from model output.

    Big Pickle emits tool calls as literal markup inside the text stream
    (``<tool_call><function=NAME>...``) instead of structured
    ``{type: "tool"}`` parts. Convert those into OpenAI-format tool calls and
    strip the markup from the visible text.

    Returns ``(clean_text, tool_calls)``.
    """
    if not text:
        return text, []
    if "<tool_call" not in text.lower():
        return text, []

    tool_calls: list[dict] = []
    clean_parts: list[str] = []
    cursor = 0
    found = 0
    for m in re.finditer(
        r"<tool_call\b[^>]*>(.*?)</tool_call\s*>",
        text, flags=re.IGNORECASE | re.DOTALL,
    ):
        body = m.group(1)
        clean_parts.append(text[cursor:m.start()])
        cursor = m.end()
        found += 1
        parsed = _build_textual_tool_call(body)
        if parsed is not None:
            tool_calls.append(parsed)

    if not found:
        return text, []

    clean_parts.append(text[cursor:])
    clean = "".join(clean_parts)
    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    return clean, tool_calls


def _bracket_block_end(text: str, start: int) -> Optional[int]:
    """Return index just past the closing ``]`` for the ``[...`` at ``start``.

    Uses bracket-depth counting so nested JSON arrays inside tool arguments
    are handled correctly. Quoted strings (single or double) and backslash
    escapes are skipped so ``[``/``]`` inside string payloads can never throw
    the depth off. Returns None if unbalanced through end of string.
    """
    depth = 0
    i = start
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "'" or ch == '"':
            quote = ch
            i += 1
            while i < n:
                c = text[i]
                if c == "\\":
                    i += 2
                    continue
                if c == quote:
                    break
                i += 1
            i += 1
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return None


def _strip_transcript_echoes(text: str) -> str:
    """Remove bracket-style transcript echoes from the model's visible text.

    Big Pickle is transcript-trained: when continuing a session whose history
    was serialized as ``[Assistant called tool: NAME with arguments: ...]`` /
    ``[Tool result for call_X: ...]`` blocks, it sometimes echoes that whole
    transcript back as its message. Those blocks are never genuine answer
    content — real tool usage is requested via ``<tool_call>`` markup (parsed
    into structured tool_calls) and rendered as cards by the client — so strip
    them before returning text.
    """
    if not text:
        return text

    marker_re = re.compile(
        r"\[(?:"
        r"Assistant called (?:tool: )?[\w\-]+ with arguments:|"
        r"Tool result for [\w\-]+:|"
        r"Function result for [\w\-]+:|"
        r"Assistant called [\w\-]+ with arguments:"
        r")"
    )

    out: list[str] = []
    pos = 0
    while True:
        m = marker_re.search(text, pos)
        if not m:
            out.append(text[pos:])
            break
        out.append(text[pos:m.start()])
        end = _bracket_block_end(text, m.start())
        if end is None:
            # Block opened but never closed (balancing was defeated by the
            # payload). Everything from the opener on is transcript junk.
            end = len(text)
        pos = end

    cleaned = "".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


class _LiveTextFilter:
    """Streams model text deltas live while holding pending markup blocks.

    Big Pickle emits tool calls as literal ``<tool_call>`` XML and sometimes
    echoes history as ``[Assistant called tool: ...]`` / ``[Tool result for
    ...]`` bracket blocks. Those must never flash in the UI as raw text, but
    the surrounding narration should stream token-by-token. This filter:

      - emits plain text immediately,
      - drops complete ``<tool_call>…</tool_call>``, ``<reasoning>…</reasoning>``
        and bracket-echo blocks (the final parsed response carries the
        structured ``tool_calls`` / ``reasoning_content`` instead),
      - holds any block still mid-emission until it closes.

    The final ``flush()`` drops a trailing unclosed markup block so the raw
    XML never reaches the client.
    """

    _TOOL_OPEN = re.compile(r"<tool_call\b[^>]*>", re.IGNORECASE)
    _TOOL_CLOSE = re.compile(r"</tool_call\s*>", re.IGNORECASE)
    _REASON_OPEN = re.compile(r"<reasoning\b[^>]*>", re.IGNORECASE)
    _REASON_CLOSE = re.compile(r"</reasoning\s*>", re.IGNORECASE)
    _BRACKET_OPEN = re.compile(
        r"\[(?:"
        r"Assistant called (?:tool: )?[\w\-]+ with arguments:|"
        r"Tool result for [\w\-]+:|"
        r"Function result for [\w\-]+:|"
        r"Assistant called [\w\-]+ with arguments:"
        r")"
    )

    def __init__(self) -> None:
        self._parts: list[str] = []

    def _candidate_blocks(self, s: str) -> list:
        blocks = []
        for m in self._TOOL_OPEN.finditer(s):
            cm = self._TOOL_CLOSE.search(s, m.end())
            blocks.append((m.start(), cm.end() if cm else None))
        for m in self._REASON_OPEN.finditer(s):
            cm = self._REASON_CLOSE.search(s, m.end())
            blocks.append((m.start(), cm.end() if cm else None))
        for m in self._BRACKET_OPEN.finditer(s):
            e = _bracket_block_end(s, m.start())
            blocks.append((m.start(), e))
        blocks.sort(key=lambda b: b[0])
        return blocks

    # Maximum bytes to hold in the buffer waiting for a block to close.
    # Beyond this we assume the block will never close in-stream and drop it.
    _MAX_HOLD = 32_768  # 32 KB

    def _drain(self) -> str:
        out: list[str] = []
        while True:
            s = "".join(self._parts)
            if not s:
                break
            blocks = self._candidate_blocks(s)
            if not blocks:
                out.append(s)
                self._parts.clear()
                break
            head_start, head_end = blocks[0]
            if head_start > 0:
                out.append(s[:head_start])
                self._parts = [s[head_start:]]
                continue
            if head_end is None:
                # Block still open at head — hold everything, but if the
                # pending buffer has grown too large the block is almost
                # certainly a big tool-result echo that will never close
                # inside a single streaming window.  Drop it so narration
                # text before the next real token can flow through.
                if len(s) > self._MAX_HOLD:
                    self._parts.clear()
                break
            # Complete markup block at head — drop it.
            self._parts = [s[head_end:]]
            continue
        return "".join(out)

    def push(self, token: str) -> str:
        self._parts.append(token)
        return self._drain()

    def flush(self) -> str:
        emitted = self._drain()
        s = "".join(self._parts)
        self._parts.clear()
        if not s:
            return emitted
        # Any remainder is an unclosed markup block — to avoid the raw XML or
        # transcript text ever reaching the client, drop it (matches the final
        # parser, which also consumes unclosed blocks through end-of-text).
        # If real narration precedes the unclosed block, keep the narration.
        blocks = self._candidate_blocks(s)
        if blocks:
            first_start = blocks[0][0]
            if first_start > 0:
                return emitted + s[:first_start]
            return emitted
        return emitted + s


def _split_reasoning_blocks(text: str) -> tuple[str, str]:
    """Move ``<reasoning>...</reasoning>`` blocks out of the visible text.

    Big Pickle writes its (verbose) thinking inside literal ``<reasoning>``
    tags in the text stream. Surface ``reasoning_content`` to the caller and
    keep only the actual answer in the visible content, mirroring what the
    cloud-mode backend already does.

    Returns ``(visible_text, reasoning_content)``.
    """
    if not text or "<reasoning" not in text.lower():
        return text, ""
    blocks: list[str] = []

    def _repl(m: re.Match) -> str:
        blocks.append(m.group(1).strip())
        return ""

    clean = re.sub(
        r"<\s*reasoning\b[^>]*>(.*?)<\s*/\s*reasoning\s*>",
        _repl, text, flags=re.IGNORECASE | re.DOTALL,
    )

    # Big Pickle sometimes opens <reasoning> without a matching close tag —
    # treat everything from an unclosed <reasoning> to end-of-text as thinking.
    dangling = re.search(
        r"<\s*reasoning\b[^>]*>\s*([\s\S]*)$", clean, flags=re.IGNORECASE,
    )
    if dangling:
        blocks.append(dangling.group(1).strip())
        clean = clean[: dangling.start()].rstrip()

    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    return clean, "\n\n".join(b for b in blocks if b)


def parse_opencode_parts(parts: list[dict]) -> tuple[str, list[dict], dict]:
    """
    Parse OpenCode message parts into:
      - text_content: concatenated text from all text/reasoning parts
      - tool_calls:   list of OpenAI-format tool calls
      - usage:        token/cost info from step-finish parts

    ToolPart fields (best-effort — test with real OpenCode to confirm):
      {type: "tool", callID, tool (name), state, args?, input?, ...}

    Big Pickle (Z3/textual backends) often emits tool calls as literal
    ``<tool_call>`` / ``<function=...>`` markup inside the text stream
    instead of structured ``{type: "tool"}`` parts. Both are parsed here.
    """
    text_parts = []
    reasoning_parts = []
    tool_calls = []
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    for part in parts:
        ptype = part.get("type", "")

        if ptype == "text":
            text = part.get("text", "")
            if text and not part.get("ignored"):
                text_parts.append(text)

        elif ptype == "reasoning":
            text = part.get("text", "")
            if text:
                reasoning_parts.append(text)

        elif ptype == "tool":
            call_id = part.get("callID", str(uuid.uuid4().hex[:12]))
            tool_name = part.get("tool", "unknown")

            # Arguments live in state.input (confirmed from OpenCode ToolPart)
            state = part.get("state", {})
            args = state.get("input", {})
            # Fallbacks: top-level fields, string parsing
            if not args:
                args = part.get("args") or part.get("arguments") or \
                       part.get("input") or part.get("parameters") or {}
            if isinstance(args, dict):
                args_str = json.dumps(args)
            elif isinstance(args, str):
                try:
                    args_str = json.dumps(json.loads(args))
                except (json.JSONDecodeError, TypeError):
                    args_str = args
            else:
                args_str = str(args)

            tool_calls.append({
                "id": call_id,
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": args_str,
                },
            })

        elif ptype == "step-finish":
            tokens = part.get("tokens", {})
            if isinstance(tokens, dict):
                usage["prompt_tokens"] = tokens.get("input", 0)
                usage["completion_tokens"] = tokens.get("output", 0)
                usage["total_tokens"] = tokens.get("total", 0)
            cost = part.get("cost", 0)
            if cost:
                usage.setdefault("cost", cost)

    text = "\n".join(text_parts)

    # Extract literal <reasoning>...</reasoning> blocks the model wrote into
    # the text stream.
    text, reasoning_from_text = _split_reasoning_blocks(text)
    if reasoning_from_text:
        reasoning_parts.append(reasoning_from_text)

    # Parse literal <tool_call>...</tool_call> markup into structured calls.
    text, textual_calls = _textual_tool_calls_from_text(text)
    if textual_calls:
        tool_calls = textual_calls + tool_calls

    # Strip transcript-echo blocks (history serialized back as visible text).
    text = _strip_transcript_echoes(text)

    # Reasoning blocks can legitimately contain the same transcript echoes —
    # the UI surfaces this as the thinking block, so keep it clean too.
    reasoning_text = _strip_transcript_echoes("\n".join(reasoning_parts))

    return text, tool_calls, usage, reasoning_text


# ── CLI backend ─────────────────────────────────────────────────────────────

def run_opencode_cli(prompt: str, model: str, timeout: int = 120) -> dict:
    """
    Run opencode in non-interactive CLI mode.
    Returns {"response": "...", "model": "..."} on success.
    CLI mode does NOT support tool calls — text-only.
    """
    sandbox = tempfile.mkdtemp(prefix="opencode-sandbox-")

    try:
        cmd = [
            "opencode",
            "-p", prompt,
            "-q",
            "-f", "json",
            "-m", model,
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=sandbox,
        )

        if result.returncode != 0:
            stderr = result.stderr.strip() or "(no stderr)"
            raise RuntimeError(
                f"OpenCode exited with code {result.returncode}: {stderr}"
            )

        output = result.stdout.strip()
        if not output:
            raise RuntimeError("OpenCode produced empty output")

        try:
            data = json.loads(output)
        except json.JSONDecodeError:
            for line in output.splitlines():
                line = line.strip()
                if line.startswith("{") and line.endswith("}"):
                    try:
                        data = json.loads(line)
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                raise RuntimeError(
                    f"Could not parse OpenCode output as JSON: {output[:500]}"
                )

        response_text = data.get("response", "")
        if not response_text:
            raise RuntimeError(
                f"OpenCode returned empty response. Output: {output[:500]}"
            )

        response_text = strip_tool_artifacts(response_text)

        return {"response": response_text, "model": model}

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"OpenCode timed out after {timeout}s")
    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


def strip_tool_artifacts(text: str) -> str:
    """Remove tool call blocks from OpenCode response text."""
    text = re.sub(r"<tool_call>.*?</tool_call>", "", text, flags=re.DOTALL)
    text = re.sub(
        r"<function_calls>.*?</function_calls>", "", text, flags=re.DOTALL
    )
    text = re.sub(r"<invoke.*?>.*?</invoke>", "", text, flags=re.DOTALL)
    text = re.sub(
        r"<antml:function_calls>.*?</antml:function_calls>",
        "", text, flags=re.DOTALL,
    )
    return text.strip()


# ── Serve backend ───────────────────────────────────────────────────────────

class OpenCodeServeClient:
    """
    HTTP client for opencode serve API.
    Parses the streamed MessageV2.WithParts JSON response.
    """

    def __init__(self, base_url: str = "http://127.0.0.1:4096"):
        self.base_url = base_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=300.0)
        return self._client

    async def health(self) -> bool:
        client = await self._get_client()
        try:
            r = await client.get(f"{self.base_url}/global/health")
            return r.status_code == 200
        except Exception:
            return False

    async def create_session(self) -> str:
        """Create session with all tool permissions denied by default."""
        client = await self._get_client()
        body = {
            "permission": [
                {"permission": "*", "pattern": "*", "action": "deny"}
            ]
        }
        r = await client.post(f"{self.base_url}/session", json=body)
        r.raise_for_status()
        return r.json()["id"]

    async def prompt(self, session_id: str, text: str,
                     model: str | None = None,
                     system: str | None = None,
                     agent: str | None = None) -> dict:
        """
        Send a prompt to OpenCode serve and return structured response.

        Returns:
          {
            "text": str,           # concatenated text parts
            "tool_calls": [...],   # OpenAI-format tool calls
            "usage": {...},        # token/cost info
            "raw_parts": [...]     # full parts array for debugging
          }
        """
        client = await self._get_client()

        body: dict = {
            "parts": [{"type": "text", "text": text}],
        }

        if model and "/" in model:
            provider_id, model_id = model.split("/", 1)
            body["model"] = {"providerID": provider_id, "modelID": model_id}
        elif model:
            body["model"] = {"providerID": "anthropic", "modelID": model}

        if system:
            body["system"] = system

        if agent:
            body["agent"] = agent

        r = await client.post(
            f"{self.base_url}/session/{session_id}/message",
            json=body,
            timeout=300.0,
        )
        if r.status_code >= 400:
            error_body = r.text[:1000] if r.text else "(empty body)"
            raise RuntimeError(
                f"OpenCode serve returned {r.status_code}: {error_body}"
            )
        r.raise_for_status()

        # Response is a JSON stream: one complete MessageV2.WithParts object.
        # Try parsing as a single JSON object, then fall back to line-by-line.
        raw = r.text.strip()

        parts = []

        # Case 1: entire response is one JSON object with {info, parts}
        try:
            msg = json.loads(raw)
            if isinstance(msg, dict) and "parts" in msg:
                parts = msg["parts"]
        except json.JSONDecodeError:
            pass

        # Case 2: newline-delimited JSON stream of events
        if not parts:
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Direct part object
                if isinstance(event, dict) and "type" in event:
                    parts.append(event)
                # Nested: {type: "part", data: {...}}
                elif event.get("type") == "part" and "data" in event:
                    parts.append(event["data"])
                # Message wrapper
                elif "parts" in event:
                    parts.extend(event["parts"])

        text, tool_calls, usage, reasoning_text = parse_opencode_parts(parts)

        # Debug: log raw parts when tool calls are detected
        if tool_calls:
            import sys
            print(f"\n[DEBUG] Tool calls detected — raw parts:", file=sys.stderr)
            for i, p in enumerate(parts):
                if p.get("type") == "tool":
                    print(f"  Part[{i}]: {json.dumps(p, indent=2)}", file=sys.stderr)
            print(file=sys.stderr)

        return {
            "text": text,
            "tool_calls": tool_calls,
            "usage": usage,
            "reasoning": reasoning_text,
            "raw_parts": parts,
        }


# ── Incremental serve streaming ─────────────────────────────────────────────

def _sse_chunk(request_id: str, model: str, created: int,
               delta: dict, finish_reason: str | None) -> str:
    chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{
            "index": 0,
            "delta": delta,
            "finish_reason": finish_reason,
        }],
    }
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


class _ServeEventHub:
    """Long-lived subscriber to opencode serve's ``GET /global/event`` SSE.

    Reads the network stream in a dedicated task that never has its reads
    cancelled (a cancelled in-flight read on httpx/httpcore tears the SSE
    connection down), and fans events out to per-session asyncio queues.
    Cancellation happens only on the queue side, which is safe.
    """

    def __init__(self, base_url: str):
        self._base_url = base_url
        self._task: asyncio.Task | None = None
        self._queues: dict[str, asyncio.Queue] = {}

    def _start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.ensure_future(self._run())

    def subscribe(self, session_id: str) -> asyncio.Queue:
        self._start()
        q: asyncio.Queue = asyncio.Queue()
        self._queues[session_id] = q
        return q

    def unsubscribe(self, session_id: str):
        self._queues.pop(session_id, None)

    async def _run(self):
        while True:
            try:
                async with httpx.AsyncClient(base_url=self._base_url,
                                             timeout=None) as sc:
                    async with sc.stream("GET", "/global/event") as resp:
                        ait = resp.aiter_lines()
                        while True:
                            try:
                                line = await ait.__anext__()
                            except StopAsyncIteration:
                                break
                            if not line.startswith("data:"):
                                continue
                            data = line[5:].strip()
                            if not data:
                                continue
                            try:
                                ev = json.loads(data)
                            except json.JSONDecodeError:
                                continue
                            payload = ev.get("payload") or {}
                            props = payload.get("properties") or {}
                            sid = props.get("sessionID")
                            if not sid:
                                continue
                            q = self._queues.get(sid)
                            if q is not None:
                                await q.put((payload.get("type"), props))
            except (asyncio.CancelledError, KeyboardInterrupt):
                raise
            except Exception:
                await asyncio.sleep(2)


_event_hubs: dict[str, _ServeEventHub] = {}


def _event_hub_for(base_url: str) -> _ServeEventHub:
    hub = _event_hubs.get(base_url)
    if hub is None:
        hub = _ServeEventHub(base_url)
        _event_hubs[base_url] = hub
    return hub


async def _serve_incremental_stream(client: OpenCodeServeClient, prompt: str,
                                    model: str, system_msg: str | None,
                                    agent: str | None,
                                    requested_model: str):
    """True incremental streaming for serve mode.

    opencode serve itself is all-at-once (the POST /session/{id}/message
    returns the whole message when done), but it pushes live part events over
    the ``GET /global/event`` SSE channel. We subscribe there and forward the
    model's real reasoning/text deltas to the OpenAI client in real time,
    holding/dropping literal tool-call XML and transcript echoes. The final
    parsed response (from the normal POST) supplies the authoritative text,
    reasoning tail, structured tool_calls and finish_reason.
    """
    request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created = int(time.time())

    # ---- generator body ----
    session_id = await client.create_session()
    hub = _event_hub_for(client.base_url)
    session_queue = hub.subscribe(session_id)
    yield _sse_chunk(request_id, requested_model, created,
                     {"role": "assistant"}, None)

    prompt_task = asyncio.ensure_future(client.prompt(
        session_id, prompt, model, system=system_msg, agent=agent))

    # Shared live-tracking used by the SSE reader.
    state = {
        "reasoning": [""],
        "text": [""],
    }
    reader_done = asyncio.Event()

    async def _sse_parts_reader(session_id: str):
        part_types: dict[str, str] = {}
        text_filter = _LiveTextFilter()
        reasoning_filter = _LiveTextFilter()
        q = session_queue
        try:
            while True:
                try:
                    etype, props = await asyncio.wait_for(
                        q.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    if prompt_task.done():
                        break
                    continue
                if etype == "message.part.updated":
                    part = props.get("part") or {}
                    if part.get("id"):
                        part_types[part["id"]] = part.get("type")
                elif etype == "message.part.delta":
                    if props.get("field") != "text":
                        continue
                    tok = props.get("delta")
                    if not tok:
                        continue
                    if part_types.get(props.get("partID")) == "reasoning":
                        # Reasoning is shown in the UI's thinking block, but a
                        # transcript echo inside it is still raw noise — route
                        # it through the same drip/echo filter as text.
                        emitted = reasoning_filter.push(tok)
                        if emitted:
                            state["reasoning"][0] += emitted
                            yield _sse_chunk(
                                request_id, requested_model, created,
                                {"reasoning_content": emitted}, None)
                    else:
                        emitted = text_filter.push(tok)
                        if emitted:
                            state["text"][0] += emitted
                            yield _sse_chunk(
                                request_id, requested_model, created,
                                {"content": emitted}, None)
                if prompt_task.done():
                    break
        finally:
            hub.unsubscribe(session_id)
            leftover_txt = text_filter.flush()
            if leftover_txt:
                state["text"][0] += leftover_txt
                yield _sse_chunk(request_id, requested_model, created,
                                 {"content": leftover_txt}, None)
            leftover_rsn = reasoning_filter.flush()
            if leftover_rsn:
                state["reasoning"][0] += leftover_rsn
                yield _sse_chunk(request_id, requested_model, created,
                                 {"reasoning_content": leftover_rsn}, None)
            reader_done.set()

    async def _cleanup_parts():
        try:
            result = await prompt_task
        except Exception:
            return

        # Wait for the SSE reader to drain every live delta emitted before the
        # prompt finished; otherwise the fallback below would re-send content
        # that is still being streamed (duplication race).
        try:
            await asyncio.wait_for(reader_done.wait(), timeout=20)
        except asyncio.TimeoutError:
            pass

        # Reconcile against the authoritative parsed response.
        result_text = result.get("text") or ""
        tool_calls = result.get("tool_calls") or []
        reasoning_content = result.get("reasoning") or ""
        usage = result.get("usage") or {}

        # Reasoning tail: streamed reasoning may have arrived only as inline
        # <reasoning> in the text stream (dropped live) — emit the missing part.
        streamed_reasoning = state["reasoning"][0]
        if (reasoning_content
                and reasoning_content.startswith(streamed_reasoning)
                and len(reasoning_content) > len(streamed_reasoning)):
            tail = reasoning_content[len(streamed_reasoning):]
            if tail.strip():
                yield _sse_chunk(
                    request_id, requested_model, created,
                    {"reasoning_content": tail}, None)

        # Content tail: if the parsed text is longer than what streamed live
        # (e.g. whitespace collapse or a late-arriving part) and it extends the
        # already-emitted text, send only the difference so nothing duplicates.
        streamed_text = state["text"][0]
        if (result_text and result_text.startswith(streamed_text)
                and len(result_text) > len(streamed_text) + 4):
            tail = result_text[len(streamed_text):]
            if tail.strip():
                yield _sse_chunk(
                    request_id, requested_model, created,
                    {"content": tail}, None)

        finish_reason = "tool_calls" if tool_calls else "stop"
        delta: dict = {}
        if tool_calls:
            # Give each call an explicit index so the client's accumulator
            # places them in distinct slots (multi-tool safety).
            delta["tool_calls"] = [
                {**tc, "index": i} for i, tc in enumerate(tool_calls)
            ]
            delta["content"] = None
        if not delta and not (state["text"][0] or state["reasoning"][0]):
            delta["content"] = result_text if result_text else None
        yield _sse_chunk(request_id, requested_model, created,
                         delta, finish_reason)
        yield "data: [DONE]\n\n"

    # Merge the SSE reader and the final cleanup streams, preserving order.
    queue: asyncio.Queue = asyncio.Queue()
    consumers = [_sse_parts_reader(session_id), _cleanup_parts()]

    async def _pump(agen):
        try:
            async for item in agen:
                await queue.put(item)
        except asyncio.CancelledError:
            raise
        finally:
            await queue.put(None)

    tasks = [asyncio.ensure_future(_pump(g)) for g in consumers]
    remaining = len(tasks)
    while remaining:
        item = await queue.get()
        if item is None:
            remaining -= 1
            continue
        yield item
    for t in tasks:
        t.cancel()


# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Big Pickle Proxy",
    description="OpenAI-compatible API forwarding to OpenCode",
    version="0.3.1",
)

config: dict = {}


@app.get("/health")
async def health():
    return {"status": "ok", "mode": config.get("mode", "unknown")}


@app.get("/v1/models")
async def list_models(request: Request):
    """Return available models — fetched live from OpenCode Zen API."""
    mode = config.get("mode", "cloud")

    if mode == "cloud":
        import httpx as _httpx
        try:
            headers = _make_cloud_headers()
            async with _httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "https://opencode.ai/zen/v1/models",
                    headers=headers,
                    timeout=10.0,
                )
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass  # Fall through to static list

    # Static fallback (used for cli/serve modes or if Zen is unreachable)
    return {"object": "list", "data": list_known_models()}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    stream = body.get("stream", False)
    requested_model = body.get("model", DEFAULT_MODEL)
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 4096)
    openai_tools = body.get("tools", [])        # OpenAI-format tool definitions
    tool_choice = body.get("tool_choice", "auto")
    reasoning_effort = body.get("reasoning_effort")  # reasoning budget control

    # Known reasoning models need more max_tokens headroom because their
    # thinking tokens count against the limit. Without this, the model
    # can think until it exhausts max_tokens and produce no output at all
    # (finish_reason="length" with empty content). This is especially
    # noticeable in multi-turn scenarios like chess after move 4-7 where
    # the position complexity triggers verbose reasoning.
    REASONING_MODEL_MIN_TOKENS = {
        "big-pickle": 16384,              # DeepSeek V3 — verbose reasoning
        "deepseek-v4-flash-free": 16384,  # Flash variant, still a reasoner
    }
    if requested_model in REASONING_MODEL_MIN_TOKENS:
        _floor = REASONING_MODEL_MIN_TOKENS[requested_model]
        if max_tokens < _floor:
            max_tokens = _floor

    if not messages:
        raise HTTPException(status_code=400, detail="messages array is required")

    model = resolve_model(requested_model)

    # Extract system message if present (first message with role=system)
    system_msg = None
    if messages and messages[0].get("role") == "system":
        system_msg = messages[0].get("content", "")

    prompt = messages_to_prompt(messages)

    # Inject tool definitions into the prompt so Big Pickle knows what's available
    if openai_tools and config.get("mode") == "serve":
        tool_desc = _format_tools_for_prompt(openai_tools)
        prompt = (
            "IMPORTANT: You have been given a specific set of tools below. "
            "IGNORE any other tools you may know about (like read, write, edit, bash, grep, glob). "
            "ONLY use the tools listed here. "
            "Other tools do not work in this environment.\n\n"
            f"{tool_desc}\n\n"
            "When you need to use one of these tools, call it using the standard "
            "function calling format. The calling system will execute it and "
            "return the result for you to continue.\n\n"
            "---\n\n"
            f"{prompt}"
        )

    # Inject temperature hint
    if temperature is not None and temperature != 0.7:
        prompt = f"[temperature={temperature}] {prompt}"

    try:
        mode = config.get("mode", "cli")

        if BPP_DEBUG:
            _tools_n = len(openai_tools)
            _msg_n = len(messages)
            _re = reasoning_effort or "none"
            print(f"[BPP] REQ model={requested_model} mt={max_tokens} "
                  f"re={_re} tools={_tools_n} msgs={_msg_n} stream={stream}",
                  file=sys.stderr, flush=True)

        if mode == "cloud":
            # ── Cloud mode: forward to OpenCode cloud API ──
            import httpx as _httpx

            # Cloud API uses plain model slugs (no provider prefix — e.g.
            # "big-pickle", not "opencode/big-pickle").  Strip any
            # provider/ prefix the client may have sent.
            model_resolved = requested_model.rsplit("/", 1)[-1]

            # Always stream from upstream to avoid oversized single-line
            # responses that trigger OpenWebUI's aiohttp "Chunk too big" error.
            # For non-streaming clients, we buffer the stream and return JSON.
            headers = _make_cloud_headers()
            payload = {
                "model": model_resolved,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": True,  # Always stream from upstream
            }
            if openai_tools:
                payload["tools"] = openai_tools
            if tool_choice and tool_choice != "auto":
                payload["tool_choice"] = tool_choice
            if reasoning_effort:
                payload["reasoning_effort"] = reasoning_effort

            # Streaming is disabled — always buffer the upstream SSE stream
            # and return an OpenAI-compatible JSON response.  Hermes' OpenAI
            # client cannot handle the reasoning-only first chunk that the
            # Zen API emits during SSE (content=null, reasoning_content="...").
            # Buffering gives every client clean JSON.
            chunks: list[dict] = []
            finish_reason = "stop"
            usage = {}
            merged_content = ""
            merged_reasoning = ""

            async with _httpx.AsyncClient(timeout=300.0) as sc:
                async with sc.stream(
                    "POST",
                    OPENCODE_CLOUD_URL,
                    json=payload,
                    headers=headers,
                    timeout=300.0,
                ) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        raise RuntimeError(
                            f"OpenCode cloud API returned {resp.status_code}: "
                            f"{body.decode()[:500]}"
                        )
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        chunks.append(chunk)

            # Merge all chunks into a single response
            tool_calls_map: dict[int, dict] = {}  # index -> tool_call dict
            for chunk in chunks:
                choices = chunk.get("choices", [])
                if choices:
                    delta = choices[0].get("delta", {})
                    if delta.get("content"):
                        merged_content += delta["content"]
                    if delta.get("reasoning_content"):
                        merged_reasoning += delta["reasoning_content"]
                    # Accumulate tool calls from streaming deltas.
                    # Zen emits explicit "tool_calls": null on reasoning
                    # chunks, so guard against None, not just absence.
                    tc_delta = delta.get("tool_calls") or []
                    for tc in tc_delta:
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_map:
                            tool_calls_map[idx] = {
                                "id": tc.get("id", ""),
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        entry = tool_calls_map[idx]
                        if tc.get("id"):
                            entry["id"] = tc["id"]
                        func = tc.get("function", {})
                        if func.get("name"):
                            entry["function"]["name"] += func["name"]
                        if func.get("arguments"):
                            entry["function"]["arguments"] += func["arguments"]
                    fr = choices[0].get("finish_reason")
                    if fr:
                        finish_reason = fr
                if chunk.get("usage"):
                    usage = chunk["usage"]

            # Strip transcript echoes that Big Pickle may have emitted into the
            # visible text (the same cleanup that serve/cli modes apply via
            # parse_opencode_parts → _strip_transcript_echoes).
            merged_content = _strip_transcript_echoes(merged_content)
            merged_reasoning = _strip_transcript_echoes(merged_reasoning)

            message = {"role": "assistant"}
            if merged_content:
                message["content"] = merged_content
            else:
                message["content"] = None
            if merged_reasoning:
                message["reasoning_content"] = merged_reasoning
            # Always include tool_calls if present, even if content is empty
            if tool_calls_map:
                message["tool_calls"] = [
                    tool_calls_map[i] for i in sorted(tool_calls_map)
                ]

            request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
            result = {
                "id": request_id,
                "object": "chat.completion",
                "created": int(time.time()),
                "model": requested_model,
                "choices": [{
                    "index": 0,
                    "message": message,
                    "finish_reason": finish_reason,
                }],
                "usage": usage,
            }
            # Pretty-print JSON to avoid OpenWebUI's aiohttp "Chunk too big"
            # error. aiohttp reads HTTP bodies line-by-line via readuntil();
            # a single 50KB unindented JSON line triggers its limit.
            # Indentation breaks response into short lines, each under 16KB.
            from fastapi.responses import Response as _Response
            pretty = json.dumps(result, indent=2, ensure_ascii=False)

            # If the client requested streaming, emit the buffered response as
            # a proper token-by-token SSE stream so the UI renders progressively
            # instead of showing raw text in one shot.
            if stream:
                choice = result["choices"][0]
                msg = choice["message"]
                finish_reason_str = choice["finish_reason"]
                content_text = msg.get("content") or ""
                reasoning_text_out = msg.get("reasoning_content") or ""
                tool_calls_out = msg.get("tool_calls") or []

                async def _stream_cloud_response():
                    rid = result["id"]
                    cr = result["created"]
                    mdl = result["model"]

                    # Opening role chunk
                    yield _sse_chunk(rid, mdl, cr, {"role": "assistant"}, None)

                    # Stream reasoning tokens first (if any)
                    if reasoning_text_out:
                        for sentence in _split_text(reasoning_text_out, chunk_size=256):
                            yield _sse_chunk(rid, mdl, cr,
                                             {"reasoning_content": sentence}, None)

                    # Stream content tokens
                    if content_text:
                        for sentence in _split_text(content_text, chunk_size=256):
                            yield _sse_chunk(rid, mdl, cr,
                                             {"content": sentence}, None)

                    # Tool calls (single chunk)
                    fin_delta: dict = {}
                    if tool_calls_out:
                        fin_delta["tool_calls"] = [
                            {**tc, "index": i}
                            for i, tc in enumerate(tool_calls_out)
                        ]
                        fin_delta["content"] = None

                    yield _sse_chunk(rid, mdl, cr, fin_delta, finish_reason_str)
                    yield "data: [DONE]\n\n"

                return StreamingResponse(
                    _stream_cloud_response(),
                    media_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                )

            if BPP_DEBUG:
                _tc = len(message.get("tool_calls", []))
                _c = len(message.get("content") or "")
                _rc = len(message.get("reasoning_content") or "")
                _pt = usage.get("prompt_tokens", 0)
                _ct = usage.get("completion_tokens", 0)
                _tt = usage.get("total_tokens", 0)
                _frac = f"{_ct}/{max_tokens}" if max_tokens else f"{_ct}"
                print(f"[BPP] RES finish={finish_reason} content={_c}B "
                      f"reasoning={_rc}B tool_calls={_tc} "
                      f"tokens(in={_pt},out={_ct}/{_frac},total={_tt})",
                      file=sys.stderr, flush=True)

            return _Response(
                content=pretty,
                media_type="application/json",
            )

        elif mode == "serve":
            serve_port = config.get("serve_port", 4096)
            client = OpenCodeServeClient(f"http://127.0.0.1:{serve_port}")

            if not await client.health():
                raise HTTPException(
                    status_code=503,
                    detail=f"OpenCode serve not reachable at "
                           f"http://127.0.0.1:{serve_port}",
                )

            # True incremental streaming for the UI (live reasoning + text
            # deltas from /global/event).  The non-streaming batch path below
            # returns the full JSON response once.
            if stream:
                return StreamingResponse(
                    _serve_incremental_stream(
                        client, prompt, model, system_msg,
                        body.get("agent"), requested_model,
                    ),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "X-Accel-Buffering": "no",
                    },
                )

            session_id = await client.create_session()
            result = await client.prompt(
                session_id, prompt, model,
                system=system_msg,
                agent=body.get("agent"),
            )

            response_text = result["text"]
            tool_calls = result["tool_calls"]
            usage = result["usage"]
            reasoning_content = result.get("reasoning", "")

            if not response_text and not tool_calls:
                raise RuntimeError("Empty response from serve API")

        else:  # cli mode
            timeout = config.get("timeout", 120)
            result = run_opencode_cli(prompt, model, timeout=timeout)
            response_text = result["response"]
            tool_calls = []
            usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            reasoning_content = ""

        request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

        # Determine finish_reason
        if tool_calls:
            finish_reason = "tool_calls"
        else:
            finish_reason = "stop"

        # Build the response message
        message: dict = {"role": "assistant"}
        if response_text:
            message["content"] = response_text
        else:
            message["content"] = None

        if reasoning_content:
            message["reasoning_content"] = reasoning_content

        if tool_calls:
            message["tool_calls"] = tool_calls

        response_body = {
            "id": request_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": requested_model,
            "choices": [
                {
                    "index": 0,
                    "message": message,
                    "finish_reason": finish_reason,
                }
            ],
            "usage": usage,
        }

        if stream:
            raise HTTPException(
                status_code=400,
                detail="Streaming requires serve or cloud mode (--mode serve|cloud)",
            )

        return response_body

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _format_tools_for_prompt(tools: list[dict]) -> str:
    """Convert OpenAI tool definitions to a prompt-friendly format."""
    lines = ["Available tools:"]
    for tool in tools:
        func = tool.get("function", {})
        name = func.get("name", "unknown")
        desc = func.get("description", "No description")
        params = func.get("parameters", {})
        lines.append(f"\n- {name}: {desc}")
        if params.get("properties"):
            lines.append("  Parameters:")
            for prop_name, prop_info in params["properties"].items():
                ptype = prop_info.get("type", "any")
                pdesc = prop_info.get("description", "")
                lines.append(f"    {prop_name} ({ptype}): {pdesc}")
    return "\n".join(lines)


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Big Pickle Proxy — OpenAI-compatible API → OpenCode"
    )
    parser.add_argument("--port", type=int, default=8000,
                        help="Proxy listen port (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1",
                        help="Proxy listen host (default: 127.0.0.1)")
    parser.add_argument("--mode", choices=["cli", "serve", "cloud"], default="cloud",
                        help="Backend mode: cloud (default, direct API), serve (local opencode), cli (subprocess)")
    parser.add_argument("--serve-port", type=int, default=4096,
                        help="OpenCode serve port (default: 4096, serve mode only)")
    parser.add_argument("--timeout", type=int, default=120,
                        help="OpenCode timeout in seconds (default: 120, cli mode only)")

    args = parser.parse_args()

    config["mode"] = args.mode
    config["serve_port"] = args.serve_port
    config["timeout"] = args.timeout

    # Check opencode is available in CLI mode
    if args.mode == "cli":
        try:
            subprocess.run(
                ["opencode", "--version"],
                capture_output=True,
                timeout=5,
            )
        except FileNotFoundError:
            print("ERROR: 'opencode' not found in PATH. Is OpenCode installed?")
            print("Install: curl -fsSL https://opencode.ai/install | bash")
            sys.exit(1)
        except Exception as e:
            print(f"WARNING: Could not verify opencode: {e}")

    import uvicorn

    print(f"\n  Big Pickle Proxy v0.3.1")
    print(f"  Mode:      {args.mode}")
    print(f"  Listen:    http://{args.host}:{args.port}")
    print(f"  Models:    {', '.join(MODEL_ALIASES.keys())}")
    if args.mode == "cloud":
        print(f"  Cloud API: {OPENCODE_CLOUD_URL}")
        free_models = [m["id"] for m in list_known_models()]
        print(f"  Free models: {', '.join(free_models)}")
        print(f"  Tool calls: enabled (forwarded to cloud API)")
        print(f"  Streaming:  enabled")
        if BPP_DEBUG:
            print(f"  Debug:      BPP_DEBUG=1 (logging to stderr)")
    if args.mode == "serve":
        print(f"  OC Serve:  http://127.0.0.1:{args.serve_port}")
        print(f"  Tool calls: enabled (ensure OC permissions deny execution)")
    print(f"\n  Test:   curl http://{args.host}:{args.port}/v1/chat/completions \\")
    print(f'           -H "Content-Type: application/json" \\')
    print(f"           -d '{{\"model\":\"big-pickle\",\"messages\":[{{\"role\":\"user\",\"content\":\"Hello\"}}]}}'")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
