#!/usr/bin/env python3
"""
Big Pickle Proxy (simple) — OpenAI-compatible API -> OpenCode `serve`.

Features:
  - Uses `opencode serve` HTTP API on a local port (default 4096).
  - Serializes multi-turn tool history using Unicode Private Use Area sentinels
    (\uE000 / \uE001) instead of human-readable brackets to eliminate prompt poisoning
    and model echo leaks.
  - Injects Anakot tool definitions (including `clarify` and `terminal`) so Big Pickle
    knows available tools and schemas.
  - Multi-tier tool parser: extracts OpenCode structured {type: "tool"} parts,
    textual <tool_call> XML, and <|DSML|invoke> blocks into standard OpenAI tool_calls.
  - Cleanly isolates <reasoning> blocks into reasoning_content for Anakot's Thinking UI.
  - Butter-smooth chunked SSE streaming with zero raw-token leaks.
  - Fully supports interactive tools like `clarify` (question choices/radios) natively.

Usage:
  1. opencode serve --port 4096
  2. python bigpickle_proxy_simple.py --port 8000 --serve-port 4096
  3. Point Anakot at http://127.0.0.1:8000/v1 as an OpenAI-compatible backend.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
import uuid
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse

BPP_DEBUG = os.environ.get("BPP_DEBUG", "") == "1"

# ── Model mapping ────────────────────────────────────────────────────────
MODEL_ALIASES = {
    "big-pickle":        "opencode/big-pickle",
    "claude-sonnet-4":   "opencode/claude-sonnet-4",
    "claude-sonnet":     "opencode/claude-sonnet-4",
    "claude-opus-4":     "opencode/claude-opus-4-1",
    "claude-opus":       "opencode/claude-opus-4-1",
    "claude-haiku":      "opencode/claude-haiku-4-5",
    "gpt-5":             "opencode/gpt-5.1",
    "gemini-flash":      "opencode/gemini-3-flash",
    "gemini-pro":        "opencode/gemini-3.1-pro",
    "deepseek-v4-flash": "opencode-go/deepseek-v4-flash",
    "deepseek-v4-pro":   "opencode-go/deepseek-v4-pro",
    "kimi-k2.5":         "opencode-go/kimi-k2.5",
    "kimi-k2.6":         "opencode-go/kimi-k2.6",
    "qwen3.7-max":       "opencode-go/qwen3.7-max",
}
DEFAULT_MODEL = "opencode/big-pickle"

config: dict = {}
app = FastAPI(title="Big Pickle Proxy (simple)", version="0.4.0")


def resolve_model(requested: str) -> str:
    return MODEL_ALIASES.get(requested, requested)


# ── Sentinel delimiters for transcript history ──────────────────────────
# Unicode Private Use Area sentinels — proxy-internal only, never legitimate
# model prose, so stripping is an exact-string match with no ambiguity or quote issues.
ECHO_OPEN = "\uE000"
ECHO_CLOSE = "\uE001"

_ECHO_RE = re.compile(re.escape(ECHO_OPEN) + r".*?" + re.escape(ECHO_CLOSE), re.DOTALL)

_MARKUP_RE = re.compile(
    r"<tool_call>.*?</tool_call>|<function_calls>.*?</function_calls>"
    r"|<invoke.*?>.*?</invoke>|<reasoning>.*?</reasoning>",
    re.DOTALL,
)

# DeepSeek DSML tool-call markup
_DSML_INVOKE_RE = re.compile(
    r'<\|DSML\|invoke\s+name="([^"]+)"\s*>(.*?)</\|DSML\|invoke>',
    re.DOTALL,
)
_DSML_PARAM_RE = re.compile(
    r'<\|DSML\|parameter\s+(?:name|parameter)="([^"]+)"[^>]*>(.*?)</\|DSML\|parameter>',
    re.DOTALL,
)
_DSML_DANGLING_RE = re.compile(r"<\|DSML\|.*$", re.DOTALL)


# ── Tool call parsers ───────────────────────────────────────────────────

def _coerce_arg_value(raw: str) -> Any:
    s = (raw or "").strip()
    if not s:
        return raw
    try:
        return json.loads(s)
    except Exception:
        return raw


def _build_textual_tool_call(body: str) -> Optional[dict]:
    """Parse one <tool_call>...</tool_call> body into an OpenAI tool call."""
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
    """Extract <tool_call> blocks from text and return (clean_text, tool_calls)."""
    if not text or "<tool_call" not in text.lower():
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


def _dsml_tool_calls_from_text(text: str) -> tuple[str, list[dict]]:
    """Extract DSML-format tool calls, converting them to OpenAI shape."""
    if not text or "<|DSML|" not in text:
        return text, []

    tool_calls: list[dict] = []
    for name, body in _DSML_INVOKE_RE.findall(text):
        args = {}
        for pname, pval in _DSML_PARAM_RE.findall(body):
            args[pname.strip()] = _coerce_arg_value(pval.strip())
        tool_calls.append({
            "id": f"call_{uuid.uuid4().hex[:16]}",
            "type": "function",
            "function": {"name": name.strip(), "arguments": json.dumps(args, ensure_ascii=False)},
        })

    clean = _DSML_INVOKE_RE.sub("", text)
    clean = _DSML_DANGLING_RE.sub("", clean)
    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    return clean, tool_calls


def _split_reasoning_blocks(text: str) -> tuple[str, str]:
    """Extract literal <reasoning>...</reasoning> blocks out of the visible text."""
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

    dangling = re.search(
        r"<\s*reasoning\b[^>]*>\s*([\s\S]*)$", clean, flags=re.IGNORECASE,
    )
    if dangling:
        blocks.append(dangling.group(1).strip())
        clean = clean[: dangling.start()].rstrip()

    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    return clean, "\n\n".join(b for b in blocks if b)


def strip_stray_markup(text: str) -> str:
    """Safety net: strip sentinels, literal tool markup, and unparsed tags.

    This is the last-resort cleaner applied to both visible text and reasoning
    content.  It must catch every flavour of tool-call / transcript noise the
    model might echo, including:
      - Unicode PUA sentinels (ECHO_OPEN / ECHO_CLOSE)
      - Complete <tool_call>…</tool_call> and <function_calls>…</function_calls>
      - Complete DSML blocks
      - **Dangling / unclosed** markup that reaches end-of-string
      - Bracket transcript echoes [Assistant called tool: …] / [Tool result …]
    """
    if not text:
        return text

    # 1. Sentinel pairs
    cleaned = _ECHO_RE.sub("", text)

    # 2. Complete markup blocks (tool_call, function_calls, invoke, reasoning)
    cleaned = _MARKUP_RE.sub("", cleaned)

    # 3. Complete DSML blocks
    cleaned = _DSML_INVOKE_RE.sub("", cleaned)

    # 4. Dangling DSML (opened but never closed — runs to end-of-string)
    cleaned = re.sub(r"<\|DSML\|.*$", "", cleaned, flags=re.DOTALL)

    # 5. Dangling / unclosed markup tags that reach end-of-string
    #    (model was cut off mid-generation). Match the opening tag and
    #    everything after it when no matching close tag follows.
    for tag in ("tool_call", "function_calls", "function", "invoke",
                "parameter", "reasoning"):
        # Only strip if there's an opening tag without a matching close
        pattern = rf"<{tag}\b[^>]*>(?:(?!</{tag}\s*>).)*$"
        cleaned = re.sub(pattern, "", cleaned, flags=re.DOTALL | re.IGNORECASE)

    # 6. Bracket transcript echoes (complete ones within [...])
    cleaned = re.sub(
        r"\[(?:Assistant called (?:tool: )?[\w\-]+ with arguments:"
        r"|Tool result for [\w\-]+:"
        r"|Function result for [\w\-]+:)"
        r"[^\]]*\]",
        "", cleaned,
    )

    # 7. Bracket echoes that opened but never closed (runs to end-of-string)
    cleaned = re.sub(
        r"\[(?:Assistant called (?:tool: )?[\w\-]+ with arguments:"
        r"|Tool result for [\w\-]+:"
        r"|Function result for [\w\-]+:)"
        r".*$",
        "", cleaned, flags=re.DOTALL,
    )

    # 8. Lone orphaned sentinel characters
    cleaned = cleaned.replace(ECHO_OPEN, "").replace(ECHO_CLOSE, "")

    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


# ── Prompt building ─────────────────────────────────────────────────────

def _format_tools_for_prompt(tools: list[dict]) -> str:
    """Format OpenAI tools (terminal, clarify, read_file, etc.) for Big Pickle."""
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
                enum_vals = prop_info.get("enum")
                enum_str = f" [options: {', '.join(map(str, enum_vals))}]" if enum_vals else ""
                lines.append(f"    {prop_name} ({ptype}{enum_str}): {pdesc}")
    return "\n".join(lines)


def messages_to_prompt(messages: list[dict], tools: list[dict] = None) -> tuple[str, Optional[str]]:
    """Flatten an OpenAI messages array into a single prompt string plus an optional system message.

    Uses Unicode Private Use Area sentinels for prior tool calls & results so the model
    never sees or learns to echo bracketed transcript text.
    """
    system_msg = None
    parts = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")
        if isinstance(content, list):
            content = "\n".join(p["text"] for p in content if p.get("type") == "text")

        if role == "system":
            system_msg = content
        elif role == "user":
            parts.append(content or "")
        elif role == "assistant":
            text = content or ""
            for tc in msg.get("tool_calls", []):
                func = tc.get("function", {})
                name = func.get("name", "unknown")
                args = func.get("arguments", "{}")
                text += f"\n\n{ECHO_OPEN}CALL:{name}:{args}{ECHO_CLOSE}"
            parts.append(text)
        elif role == "tool":
            parts.append(f"{ECHO_OPEN}RESULT:{content or ''}{ECHO_CLOSE}")

    prompt = "\n\n".join(p for p in parts if p)

    if tools:
        tool_desc = _format_tools_for_prompt(tools)
        tool_instructions = (
            "IMPORTANT: You have been given a specific set of tools below. "
            "IGNORE any other tools you may know about (like read, write, edit, bash, grep, glob). "
            "ONLY use the tools listed here. "
            "When you need to use one of these tools, call it using standard function calling.\n\n"
            f"{tool_desc}\n\n"
            "---\n\n"
        )
        prompt = tool_instructions + prompt

    return prompt, system_msg


def _clean_tool_markup_from_text(text: str) -> tuple[str, list[dict]]:
    """Run every tool-call parser and markup stripper on arbitrary text.

    Returns ``(cleaned_text, extracted_tool_calls)``.  Designed so the same
    cleanup pipeline can be applied to both the visible answer *and* the
    reasoning content — Big Pickle sometimes echoes tool-call XML / DSML
    inside ``<reasoning>`` tags after several multi-turn tool calls.
    """
    if not text:
        return text, []

    all_calls: list[dict] = []

    # Textual <tool_call><function=...>...</tool_call>
    text, tc = _textual_tool_calls_from_text(text)
    if tc:
        all_calls.extend(tc)

    # DeepSeek DSML <|DSML|invoke name="...">...</|DSML|invoke>
    text, dc = _dsml_tool_calls_from_text(text)
    if dc:
        all_calls.extend(dc)

    # Final safety-net: sentinels, stray XML tags, bracket echoes
    text = strip_stray_markup(text)

    return text, all_calls


def parse_opencode_parts(parts: list[dict]) -> tuple[str, list[dict], dict, str]:
    """Parse OpenCode structured parts, textual tool calls, DSML, and reasoning."""
    text_parts, reasoning_parts, tool_calls = [], [], []
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    for part in parts:
        ptype = part.get("type", "")
        if ptype == "text":
            if part.get("text") and not part.get("ignored"):
                text_parts.append(part["text"])
        elif ptype == "reasoning":
            if part.get("text"):
                reasoning_parts.append(part["text"])
        elif ptype == "tool":
            state = part.get("state", {})
            args = state.get("input") or part.get("args") or part.get("input") or {}
            tool_calls.append({
                "id": part.get("callID", f"call_{uuid.uuid4().hex[:16]}"),
                "type": "function",
                "function": {
                    "name": part.get("tool", "unknown"),
                    "arguments": json.dumps(args, ensure_ascii=False) if isinstance(args, dict) else str(args),
                },
            })
        elif ptype == "step-finish":
            tokens = part.get("tokens", {})
            if isinstance(tokens, dict):
                usage["prompt_tokens"] = tokens.get("input", 0)
                usage["completion_tokens"] = tokens.get("output", 0)
                usage["total_tokens"] = tokens.get("total", 0)

    text = "\n".join(text_parts)

    # 1. Extract <reasoning> blocks from the text stream
    text, reasoning_from_text = _split_reasoning_blocks(text)
    if reasoning_from_text:
        reasoning_parts.append(reasoning_from_text)

    # 2. Clean tool markup from the VISIBLE text
    text, textual_calls = _clean_tool_markup_from_text(text)
    if textual_calls:
        tool_calls = textual_calls + tool_calls

    # 3. Clean tool markup from REASONING text too — Big Pickle echoes
    #    tool-call XML / DSML / bracket transcripts inside its thinking
    #    after several multi-turn tool rounds.  We strip the markup but
    #    don't count the extracted calls (they'd be duplicates of what
    #    the visible-text or structured-parts parser already captured).
    reasoning_raw = "\n".join(reasoning_parts)
    reasoning, _reasoning_calls = _clean_tool_markup_from_text(reasoning_raw)

    return text, tool_calls, usage, reasoning


# ── OpenCode serve client ───────────────────────────────────────────────

class OpenCodeServeClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                r = await c.get(f"{self.base_url}/global/health")
                return r.status_code == 200
        except Exception:
            return False

    async def create_session(self) -> str:
        async with httpx.AsyncClient(timeout=30.0) as c:
            try:
                # Try deny-all permissions so OpenCode delegates tools to Anakot
                r = await c.post(f"{self.base_url}/session", json={
                    "permission": [{"permission": "*", "pattern": "*", "action": "deny"}]
                })
                if r.status_code == 200:
                    return r.json()["id"]
            except Exception:
                pass
            # Fallback to standard session creation
            r = await c.post(f"{self.base_url}/session", json={})
            r.raise_for_status()
            return r.json()["id"]

    async def prompt(self, session_id: str, text: str, model: str,
                     system: Optional[str] = None) -> dict:
        body: dict = {"parts": [{"type": "text", "text": text}]}
        if "/" in model:
            provider_id, model_id = model.split("/", 1)
            body["model"] = {"providerID": provider_id, "modelID": model_id}
        if system:
            body["system"] = system

        async with httpx.AsyncClient(timeout=300.0) as c:
            r = await c.post(f"{self.base_url}/session/{session_id}/message",
                             json=body, timeout=300.0)
            if r.status_code >= 400:
                raise RuntimeError(f"OpenCode serve {r.status_code}: {r.text[:500]}")

        raw = r.text.strip()
        parts = []

        try:
            msg = json.loads(raw)
            if isinstance(msg, dict) and "parts" in msg:
                parts = msg["parts"]
        except json.JSONDecodeError:
            pass

        if not parts:
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    if isinstance(event, dict) and "type" in event:
                        parts.append(event)
                    elif event.get("type") == "part" and "data" in event:
                        parts.append(event["data"])
                    elif "parts" in event:
                        parts.extend(event["parts"])
                except json.JSONDecodeError:
                    continue

        text_out, tool_calls, usage, reasoning = parse_opencode_parts(parts)
        return {
            "text": text_out,
            "tool_calls": tool_calls,
            "usage": usage,
            "reasoning": reasoning,
        }


def _sse_chunk(request_id: str, model: str, created: int, delta: dict,
               finish_reason: Optional[str]) -> str:
    chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, size: int = 40) -> list[str]:
    """Split text into small pieces for smooth typing and thinking animations."""
    if not text:
        return []
    return [text[i:i + size] for i in range(0, len(text), size)]


# ── Routes ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "proxy": "simple"}


@app.get("/v1/models")
async def list_models():
    return {"object": "list", "data": [
        {"id": k, "object": "model", "created": 1718400000, "owned_by": "opencode"}
        for k in MODEL_ALIASES
    ]}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    stream = body.get("stream", False)
    requested_model = body.get("model", DEFAULT_MODEL)
    tools = body.get("tools", [])

    if not messages:
        raise HTTPException(400, "messages array is required")

    model = resolve_model(requested_model)
    prompt, system_msg = messages_to_prompt(messages, tools=tools)

    serve_port = config.get("serve_port", 4096)
    client = OpenCodeServeClient(f"http://127.0.0.1:{serve_port}")

    if not await client.health():
        raise HTTPException(503, f"opencode serve not reachable on port {serve_port} "
                                  f"— is `opencode serve` running?")

    try:
        session_id = await client.create_session()
        result = await client.prompt(session_id, prompt, model, system=system_msg)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

    response_text = result["text"]
    tool_calls = result["tool_calls"]
    reasoning = result["reasoning"]
    usage = result["usage"]
    finish_reason = "tool_calls" if tool_calls else "stop"

    if BPP_DEBUG:
        print(f"[BPP] finish={finish_reason} text={len(response_text)}B "
              f"reasoning={len(reasoning)}B tool_calls={len(tool_calls)}",
              file=sys.stderr, flush=True)

    if stream:
        request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        created = int(time.time())

        async def gen():
            # Initial role chunk
            yield _sse_chunk(request_id, requested_model, created, {"role": "assistant"}, None)

            # Stream reasoning for thinking animation
            if reasoning:
                for piece in _chunk_text(reasoning, size=60):
                    yield _sse_chunk(request_id, requested_model, created,
                                     {"reasoning_content": piece}, None)
                    await asyncio.sleep(0.008)

            # Stream content for smooth typing effect
            if response_text:
                for piece in _chunk_text(response_text, size=35):
                    yield _sse_chunk(request_id, requested_model, created,
                                     {"content": piece}, None)
                    await asyncio.sleep(0.012)

            # Emit tool calls (including `clarify`) in final chunk
            final_delta: dict = {}
            if tool_calls:
                final_delta["tool_calls"] = [
                    {**tc, "index": i} for i, tc in enumerate(tool_calls)
                ]
                final_delta["content"] = None

            yield _sse_chunk(request_id, requested_model, created, final_delta, finish_reason)
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Non-streaming JSON response
    message: dict = {"role": "assistant", "content": response_text or None}
    if reasoning:
        message["reasoning_content"] = reasoning
    if tool_calls:
        message["tool_calls"] = tool_calls

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": requested_model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish_reason}],
        "usage": usage,
    }


# ── CLI ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Big Pickle Proxy (simple, serve-only)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--serve-port", type=int, default=4096,
                        help="Port that `opencode serve` is listening on")
    parser.add_argument("--mode", type=str, default="serve",
                        help="Compatibility flag (default: serve)")
    args = parser.parse_args()

    config["serve_port"] = args.serve_port

    import uvicorn
    print(f"\n  Big Pickle Proxy (simple) — leak-free serve mode")
    print(f"  Listen:    http://{args.host}:{args.port}")
    print(f"  OC serve:  http://127.0.0.1:{args.serve_port}")
    print(f"  Models:    {', '.join(MODEL_ALIASES.keys())}")
    print(f"  Tool calls & Clarify: enabled (sentinel-isolated)")
    print(f"\n  Make sure `opencode serve --port {args.serve_port}` is running first.\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
