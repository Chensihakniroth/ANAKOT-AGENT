"""Terminal ASCII timeline renderer for ``/journey``.

Displays a chronological timeline of learned skills and memory entries,
grouped by date, with node-editing and deletion subcommands. Uses the
``agent.learning_graph`` data and ``agent.learning_mutations`` for mutations.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from anakot_constants import get_anakot_home


# ── Timeline rendering ─────────────────────────────────────────────────


def _format_ts(ts: Optional[int]) -> str:
    """Human-readable local timestamp from unix epoch seconds."""
    if ts is None:
        return "unknown"
    try:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
    except (OSError, ValueError):
        return "unknown"


def _date_key(ts: Optional[int]) -> str:
    if ts is None:
        return "unknown"
    try:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
    except (OSError, ValueError):
        return "unknown"


def _kind_icon(node: Dict[str, Any]) -> str:
    kind = node.get("kind", "")
    if kind == "skill":
        if node.get("pinned"):
            return "📌"
        if node.get("createdBy") == "agent":
            return "🤖"
        return "📘"
    if kind == "memory":
        source = node.get("memorySource", "")
        return "👤" if source == "profile" else "💭"
    return "•"


def _state_badge(node: Dict[str, Any]) -> str:
    state = node.get("state", "active")
    if state == "archived":
        return " [archived]"
    if state == "stale":
        return " [stale]"
    return ""


def render_timeline(graph: Dict[str, Any], *, limit: int = 60) -> List[str]:
    """Render the journey timeline as terminal-printable lines.

    Nodes are sorted newest-first and grouped by date.
    """
    nodes: List[Dict[str, Any]] = graph.get("nodes") or []
    stats: Dict[str, Any] = graph.get("stats") or {}

    if not nodes:
        return [
            "  (._.) No learned skills or memories yet.",
            "",
            "  Create skills with /learn, or chat to build memories.",
        ]

    # Sort newest-first, stable
    sorted_nodes = sorted(
        nodes,
        key=lambda n: (n.get("timestamp") or 0, n.get("id", "")),
        reverse=True,
    )[:limit]

    lines: List[str] = []

    # Header
    lines.append("  ╭─ Learning Journey ─────────────────────────────╮")
    lines.append(f"  │  {stats.get('skills', 0)} skills · {stats.get('memories', 0)} memories · {stats.get('edges', 0)} connections  │")
    lines.append("  ╰────────────────────────────────────────────────╯")
    lines.append("")

    # Group by date
    current_date = ""
    for node in sorted_nodes:
        ts = node.get("timestamp")
        date = _date_key(ts)
        if date != current_date:
            current_date = date
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(f"  ── {date} ──")

        icon = _kind_icon(node)
        label = node.get("label") or node.get("id") or "?"
        badge = _state_badge(node)
        use_count = node.get("useCount", 0)
        time_str = _format_ts(ts).split(" ", 1)[1] if ts else ""

        # Main node line
        node_line = f"  │ {icon} {label}{badge}"
        if use_count > 0:
            node_line += f"  ({use_count}×)"
        if time_str:
            node_line += f"  {time_str}"
        lines.append(node_line)

        # Category subtitle for skills
        if node.get("kind") == "skill":
            cat = node.get("category", "")
            created = node.get("createdBy")
            parts = []
            if cat and cat != "general":
                parts.append(cat)
            if created:
                parts.append(f"by {created}")
            if parts:
                lines.append(f"  │   └ {' · '.join(parts)}")

    lines.append("")
    lines.append("  Subcommands: /journey list | /journey delete <id> | /journey edit <id>")
    return lines


# ── Subcommand handlers ─────────────────────────────────────────────────


def handle_journey_subcommand(args: str) -> List[str]:
    """Dispatch ``/journey [subcommand]`` and return printable lines."""
    parts = args.strip().split(None, 1)
    sub = parts[0].lower() if parts else "list"
    rest = parts[1].strip() if len(parts) > 1 else ""

    if sub in ("list", "ls", ""):
        return _subcmd_list()
    if sub in ("delete", "del", "rm", "remove"):
        return _subcmd_delete(rest)
    if sub in ("edit", "update"):
        return _subcmd_edit(rest)
    if sub in ("stats", "info"):
        return _subcmd_stats()

    return [f"  (._.) Unknown subcommand: {sub}", "", "  Usage: /journey [list | delete <id> | edit <id> | stats]"]


def _subcmd_list() -> List[str]:
    from agent.learning_graph import build_learning_graph

    graph = build_learning_graph()
    return render_timeline(graph)


def _subcmd_stats() -> List[str]:
    from agent.learning_graph import build_learning_graph

    graph = build_learning_graph()
    stats = graph.get("stats", {})
    clusters = graph.get("clusters", [])

    lines = [
        "  Learning Journey Stats",
        f"    Skills:     {stats.get('skills', 0)}",
        f"    Memories:   {stats.get('memories', 0)}",
        f"    Edges:      {stats.get('edges', 0)}",
        f"    Connected:  {stats.get('linked_nodes', 0)}",
    ]
    if clusters:
        lines.append("")
        lines.append("  Categories:")
        for cl in sorted(clusters, key=lambda c: -c.get("count", 0)):
            lines.append(f"    {cl['category']}: {cl['count']}")
    return lines


def _subcmd_delete(node_id: str) -> List[str]:
    if not node_id:
        return ["  (._.) Please specify a node id: /journey delete <id>"]

    from agent.learning_mutations import delete_node

    result = delete_node(node_id)
    if result.get("ok"):
        return [f"  ✓ {result.get('message', 'deleted')}"]
    return [f"  ✗ {result.get('message', 'failed')}"]


def _subcmd_edit(node_id: str) -> List[str]:
    """Show the current content for editing (prefill). Actual editing
    happens in the desktop/TUI overlay — CLI just shows the content."""
    if not node_id:
        return ["  (._.) Please specify a node id: /journey edit <id>"]

    from agent.learning_mutations import node_detail

    detail = node_detail(node_id)
    if not detail.get("ok"):
        return [f"  ✗ {detail.get('message', 'not found')}"]

    content = detail.get("content", "")
    preview = content[:800]
    if len(content) > 800:
        preview += "\n... (truncated)"

    lines = [
        f"  {detail.get('kind', '').title()}: {detail.get('label', node_id)}",
        "  ─" * 20,
    ]
    for line in preview.splitlines():
        lines.append(f"  {line}")
    lines.append("")
    lines.append("  To edit, use: /journey edit <id> in the desktop app or TUI.")
    return lines
