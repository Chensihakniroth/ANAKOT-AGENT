"""Foreign session import and transcript conversion for Anakot.

Discovers, parses, and converts external AI coding session transcripts
(Claude Code, OpenAI Codex CLI, generic JSON/JSONL, and Markdown transcripts)
into Anakot's SQLite SessionDB format.
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ForeignSessionMeta:
    """Metadata describing a discoverable foreign session."""
    handle: str
    source: str  # "claude_code" | "codex" | "transcript" | "markdown"
    title: str
    path: str
    modified_at: float
    message_count: int
    cwd: Optional[str] = None
    preview_turns: List[Dict[str, str]] = field(default_factory=list)


def _extract_text_from_content(content: Any) -> str:
    """Extract plain text string from arbitrary content structure (str, list of blocks, dict)."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Common Anthropic/OpenAI block formats
                btype = block.get("type", "")
                if btype in ("text", "input_text", "output_text"):
                    parts.append(block.get("text", ""))
                elif btype == "tool_use":
                    tool_name = block.get("name", "tool")
                    args = block.get("input", {})
                    parts.append(f"[Tool Call: {tool_name}({json.dumps(args, ensure_ascii=False)})]")
                elif btype == "tool_result":
                    res_content = block.get("content", "")
                    if isinstance(res_content, list):
                        parts.append(" ".join(b.get("text", "") for b in res_content if isinstance(b, dict)))
                    else:
                        parts.append(str(res_content))
                elif "text" in block:
                    parts.append(str(block["text"]))
        return "\n".join(p for p in parts if p)
    if isinstance(content, dict):
        if "text" in content:
            return str(content["text"])
        return json.dumps(content, ensure_ascii=False)
    return str(content)


def parse_claude_session(file_path: Path) -> List[Dict[str, Any]]:
    """Parse Claude Code project/session JSONL file into normalized Anakot messages."""
    messages: List[Dict[str, Any]] = []
    if not file_path.exists():
        return messages

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue

            role = None
            content = None
            tool_calls = None
            tool_name = None
            tool_call_id = None

            # Pattern 1: Claude Code transcript event
            evt_type = data.get("type")
            if evt_type in ("user", "human"):
                role = "user"
                content = data.get("text") or data.get("content") or (data.get("message", {}).get("content") if isinstance(data.get("message"), dict) else None)
            elif evt_type in ("assistant", "model", "agent"):
                role = "assistant"
                content = data.get("text") or data.get("content") or (data.get("message", {}).get("content") if isinstance(data.get("message"), dict) else None)
            elif "role" in data:
                # Pattern 2: Standard message object
                role = data.get("role")
                content = data.get("content")
            elif "message" in data and isinstance(data["message"], dict):
                msg = data["message"]
                role = msg.get("role")
                content = msg.get("content")

            if not role:
                continue

            text_content = _extract_text_from_content(content)
            if not text_content and not tool_calls:
                continue

            messages.append({
                "role": role,
                "content": text_content,
                "tool_calls": tool_calls,
                "tool_name": tool_name,
                "tool_call_id": tool_call_id,
                "timestamp": float(data.get("timestamp") or time.time()),
            })

    return messages


def parse_codex_session(file_path: Path) -> List[Dict[str, Any]]:
    """Parse OpenAI Codex rollout or session JSONL file."""
    messages: List[Dict[str, Any]] = []
    if not file_path.exists():
        return messages

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue

            # Codex formats: {"role": ..., "content": ...} or {"type": "message", ...}
            item = data.get("item") or data
            role = item.get("role")
            if not role:
                itype = item.get("type", "")
                if itype in ("user_message", "user"):
                    role = "user"
                elif itype in ("assistant_message", "assistant", "agent"):
                    role = "assistant"
                elif itype in ("system", "developer"):
                    role = "system"

            if not role:
                continue

            content = item.get("content") or item.get("text")
            text_content = _extract_text_from_content(content)
            if not text_content:
                continue

            messages.append({
                "role": role,
                "content": text_content,
                "timestamp": float(data.get("timestamp") or time.time()),
            })

    return messages


def parse_markdown_transcript(text: str) -> List[Dict[str, Any]]:
    """Parse Markdown transcripts with section headers into turns."""
    messages: List[Dict[str, Any]] = []
    # Match headers like `# User`, `## Assistant`, `**User:**`, `User:`
    header_pattern = re.compile(
        r"^(?:#{1,4}\s*|\*{2})?(User|Human|Assistant|Agent|Model|System)(?:\*{2})?:?\s*$",
        re.IGNORECASE | re.MULTILINE
    )

    matches = list(header_pattern.finditer(text))
    if not matches:
        # Fallback: line-prefix format e.g. "User: ..."
        line_prefix_pattern = re.compile(r"^(User|Human|Assistant|Agent|Model|System):\s*(.*)$", re.IGNORECASE)
        current_role = None
        current_lines: List[str] = []

        for line in text.splitlines():
            m = line_prefix_pattern.match(line)
            if m:
                if current_role and current_lines:
                    messages.append({
                        "role": current_role,
                        "content": "\n".join(current_lines).strip(),
                        "timestamp": time.time(),
                    })
                    current_lines = []
                speaker = m.group(1).lower()
                current_role = "user" if speaker in ("user", "human") else ("assistant" if speaker in ("assistant", "agent", "model") else "system")
                current_lines.append(m.group(2))
            elif current_role is not None:
                current_lines.append(line)

        if current_role and current_lines:
            messages.append({
                "role": current_role,
                "content": "\n".join(current_lines).strip(),
                "timestamp": time.time(),
            })
        return messages

    for i, match in enumerate(matches):
        speaker = match.group(1).lower()
        role = "user" if speaker in ("user", "human") else ("assistant" if speaker in ("assistant", "agent", "model") else "system")
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        turn_text = text[start:end].strip()
        if turn_text:
            messages.append({
                "role": role,
                "content": turn_text,
                "timestamp": time.time(),
            })

    return messages


def parse_generic_file(file_path: Path) -> List[Dict[str, Any]]:
    """Parse generic JSON, JSONL, or Markdown file into messages."""
    if not file_path.exists():
        return []

    ext = file_path.suffix.lower()
    if ext == ".md" or ext == ".txt":
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            return parse_markdown_transcript(content)
        except Exception:
            return []

    # Try full JSON parse
    if ext == ".json":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            if isinstance(data, list):
                # list of message dicts
                msgs = []
                for item in data:
                    if isinstance(item, dict) and "role" in item:
                        msgs.append({
                            "role": item["role"],
                            "content": _extract_text_from_content(item.get("content")),
                            "timestamp": float(item.get("timestamp") or time.time()),
                        })
                if msgs:
                    return msgs
            elif isinstance(data, dict):
                # dict with "messages", "turns", "history", or "conversation"
                for key in ("messages", "turns", "history", "conversation", "trajectory"):
                    sub = data.get(key)
                    if isinstance(sub, list):
                        msgs = []
                        for item in sub:
                            if isinstance(item, dict) and "role" in item:
                                msgs.append({
                                    "role": item["role"],
                                    "content": _extract_text_from_content(item.get("content")),
                                    "timestamp": float(item.get("timestamp") or time.time()),
                                })
                        if msgs:
                            return msgs
        except Exception:
            pass

    # Try line-by-line JSONL
    msgs = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if isinstance(data, dict):
                        role = data.get("role") or data.get("type")
                        if role in ("user", "human", "assistant", "agent", "system"):
                            normalized_role = "user" if role in ("user", "human") else ("assistant" if role in ("assistant", "agent") else "system")
                            content = data.get("content") or data.get("text")
                            msgs.append({
                                "role": normalized_role,
                                "content": _extract_text_from_content(content),
                                "timestamp": float(data.get("timestamp") or time.time()),
                            })
                except Exception:
                    continue
    except Exception:
        pass

    return msgs


def detect_and_parse(file_path: Path) -> Tuple[str, List[Dict[str, Any]]]:
    """Auto-detect foreign format and return (source_type, messages)."""
    p_str = str(file_path).lower()
    if ".claude" in p_str:
        msgs = parse_claude_session(file_path)
        if msgs:
            return "claude_code", msgs
    elif ".codex" in p_str:
        msgs = parse_codex_session(file_path)
        if msgs:
            return "codex", msgs

    if file_path.suffix.lower() in (".md", ".markdown", ".txt"):
        msgs = parse_markdown_transcript(file_path.read_text(encoding="utf-8", errors="ignore"))
        if msgs:
            return "markdown", msgs

    # Fallback to generic parsing
    msgs = parse_generic_file(file_path)
    if msgs:
        return "transcript", msgs

    # Last ditch claude/codex attempt
    msgs = parse_claude_session(file_path)
    if msgs:
        return "claude_code", msgs

    return "unknown", []


def derive_session_title(messages: List[Dict[str, Any]], fallback: str = "Imported Session") -> str:
    """Derive a clean title from the first user message or first turn."""
    for msg in messages:
        if msg.get("role") == "user":
            content = (msg.get("content") or "").strip()
            first_line = content.splitlines()[0].strip() if content else ""
            if first_line:
                # Truncate clean title
                return first_line[:60] + ("…" if len(first_line) > 60 else "")
    return fallback


def import_foreign_session(
    file_path: Union[str, Path],
    db: Any,
    source: Optional[str] = None,
    title: Optional[str] = None,
    session_id: Optional[str] = None,
    cwd: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse and insert a foreign session into SQLite SessionDB.

    Returns summary dictionary with created session details.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Transcript file not found: {path}")

    detected_source, messages = detect_and_parse(path)
    final_source = source or detected_source
    if not messages:
        raise ValueError(f"No messages could be extracted from: {path}")

    final_title = title or derive_session_title(messages, fallback=f"Imported {path.stem}")
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    short_uuid = uuid.uuid4().hex[:6]
    final_session_id = session_id or f"imp_{timestamp_str}_{short_uuid}"

    started_at = messages[0].get("timestamp") or time.time()
    ended_at = messages[-1].get("timestamp") or time.time()

    # Create session record in SessionDB
    db.create_session(
        session_id=final_session_id,
        source=f"foreign_{final_source}",
        cwd=cwd or str(path.parent),
    )
    if hasattr(db, "set_session_title") and final_title:
        db.set_session_title(final_session_id, final_title)
    if hasattr(db, "end_session"):
        db.end_session(final_session_id, "imported")

    # Insert all messages
    db.replace_messages(final_session_id, messages)

    return {
        "session_id": final_session_id,
        "title": final_title,
        "source": final_source,
        "path": str(path),
        "message_count": len(messages),
        "started_at": started_at,
        "ended_at": ended_at,
    }
