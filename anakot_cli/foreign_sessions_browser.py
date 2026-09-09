"""Discovery, indexing, and preview browser for foreign session transcripts."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from anakot_cli.foreign_sessions import (
    ForeignSessionMeta,
    detect_and_parse,
    derive_session_title,
)


_HANDLE_CACHE: Dict[str, Path] = {}


def _make_handle(path: Path) -> str:
    """Generate a short deterministic handle for a file path."""
    h = hashlib.sha256(str(path.resolve()).encode("utf-8")).hexdigest()[:12]
    return f"fs_{h}"


def get_default_search_roots() -> List[Path]:
    """Return standard search roots for foreign coding sessions."""
    home = Path.home()
    roots = [
        home / ".claude" / "projects",
        home / ".claude" / "transcripts",
        home / ".codex" / "sessions",
        home / ".codex" / "rollouts",
        home / ".anakot" / "transcripts",
    ]
    return [r for r in roots if r.exists()]


def discover_foreign_sessions(
    roots: Optional[List[Path]] = None,
    limit: int = 50,
) -> List[ForeignSessionMeta]:
    """Scan configured roots for foreign session transcript files."""
    search_roots = roots if roots is not None else get_default_search_roots()
    discovered: List[ForeignSessionMeta] = []
    seen_paths = set()

    for root in search_roots:
        if not root.exists():
            continue

        # Find .json, .jsonl, .md transcript files
        patterns = ["*.jsonl", "*.json", "*.transcript.jsonl", "*.md"]
        for pat in patterns:
            try:
                # Limit recursive depth to avoid scanning node_modules / .git
                files = []
                for p in root.rglob(pat):
                    p_parts = p.parts
                    if any(ignored in p_parts for ignored in (".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build")):
                        continue
                    files.append(p)
                    if len(files) >= 100:
                        break
            except Exception:
                continue

            for fpath in files:
                abs_p = str(fpath.resolve())
                if abs_p in seen_paths:
                    continue
                seen_paths.add(abs_p)

                try:
                    stat = fpath.stat()
                    # Skip empty or giant files (> 20 MB)
                    if stat.st_size == 0 or stat.st_size > 20 * 1024 * 1024:
                        continue

                    source, messages = detect_and_parse(fpath)
                    if not messages:
                        continue

                    handle = _make_handle(fpath)
                    title = derive_session_title(messages, fallback=fpath.stem)

                    # Prepare 2 sample preview turns
                    preview = []
                    for m in messages[:3]:
                        cnt = m.get("content", "")
                        preview.append({
                            "role": m.get("role", "user"),
                            "content": (cnt[:120] + "…") if len(cnt) > 120 else cnt,
                        })

                    _HANDLE_CACHE[handle] = Path(abs_p)
                    discovered.append(
                        ForeignSessionMeta(
                            handle=handle,
                            source=source,
                            title=title,
                            path=abs_p,
                            modified_at=stat.st_mtime,
                            message_count=len(messages),
                            cwd=str(fpath.parent),
                            preview_turns=preview,
                        )
                    )

                    if len(discovered) >= limit:
                        break
                except Exception:
                    continue

            if len(discovered) >= limit:
                break

    # Sort by modified time descending (newest first)
    discovered.sort(key=lambda s: s.modified_at, reverse=True)
    return discovered[:limit]


def resolve_handle_to_path(handle_or_path: str, roots: Optional[List[Path]] = None) -> Optional[Path]:
    """Resolve either an existing path string or a discovery handle to a Path."""
    p = Path(handle_or_path)
    if p.exists() and p.is_file():
        return p

    # Check in-memory handle cache first
    if handle_or_path in _HANDLE_CACHE:
        cached = _HANDLE_CACHE[handle_or_path]
        if cached.exists():
            return cached

    # Otherwise search discovered sessions for matching handle
    for meta in discover_foreign_sessions(roots=roots, limit=100):
        if meta.handle == handle_or_path:
            return Path(meta.path)
    return None


def preview_foreign_session(
    handle_or_path: str,
    max_turns: int = 40,
    max_bytes_per_turn: int = 8192,
    roots: Optional[List[Path]] = None,
) -> Dict[str, Any]:
    """Return bounded turn preview for a foreign session."""
    target_path = resolve_handle_to_path(handle_or_path, roots=roots)
    if not target_path or not target_path.exists():
        raise FileNotFoundError(f"Cannot resolve session handle or path: {handle_or_path}")

    source, messages = detect_and_parse(target_path)
    title = derive_session_title(messages, fallback=target_path.stem)

    bounded_turns = []
    for msg in messages[:max_turns]:
        content = msg.get("content", "")
        truncated = False
        if len(content.encode("utf-8", errors="ignore")) > max_bytes_per_turn:
            content = content[:max_bytes_per_turn] + "… [truncated]"
            truncated = True

        bounded_turns.append({
            "role": msg.get("role", "user"),
            "content": content,
            "truncated": truncated,
            "timestamp": msg.get("timestamp"),
        })

    return {
        "handle": _make_handle(target_path),
        "path": str(target_path),
        "source": source,
        "title": title,
        "total_turns": len(messages),
        "preview_turns": bounded_turns,
        "modified_at": target_path.stat().st_mtime,
    }
