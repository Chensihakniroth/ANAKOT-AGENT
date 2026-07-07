"""Assemble the "learning made visible" graph for the Memory Graph (starmap/).

This graph is intentionally scoped to what a user actually learns over time:
- non-base, learned/profile skills (agent-created or used),
- memory chunks from ``MEMORY.md`` / ``USER.md`` as first-class nodes.

Skill links come from declared ``related_skills``. Memory-to-skill links are
derived from lexical overlap so the graph can answer "which learned skills are
connected to the things I remember?".
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from anakot_constants import get_anakot_home
from agent.skill_utils import parse_frontmatter


@dataclass
class SkillNode:
    name: str
    category: str
    source: str = "profile"
    timestamp: Optional[int] = None
    use_count: int = 0
    state: str = "active"
    created_by: Optional[str] = None
    pinned: bool = False
    related: list[str] = field(default_factory=list)


def _hermes_meta(fm: dict[str, Any]) -> dict[str, Any]:
    """``metadata.hermes`` as a dict, tolerant of string-valued frontmatter."""
    meta = fm.get("metadata")
    hermes = meta.get("hermes") if isinstance(meta, dict) else None
    return hermes if isinstance(hermes, dict) else {}


def _related(fm: dict[str, Any]) -> list[str]:
    raw = fm.get("related_skills") or _hermes_meta(fm).get("related_skills")
    if isinstance(raw, list):
        return [str(r).strip() for r in raw if str(r).strip()]
    if isinstance(raw, str):
        return [r.strip() for r in raw.strip("[]").split(",") if r.strip()]
    return []


def _category(fm: dict[str, Any], skill_md: Path) -> str:
    cat = fm.get("category") or _hermes_meta(fm).get("category")
    if cat:
        return str(cat)
    # …/skills/<category>/<skill>/SKILL.md
    parts = skill_md.parts
    return parts[-3] if len(parts) >= 3 else "general"


def _iter_skill_files(roots: list[tuple[str, Path]]):
    for source, root in roots:
        if root.exists():
            for path in root.rglob("SKILL.md"):
                yield source, path


def _load_usage() -> dict[str, dict[str, Any]]:
    """Load skill usage tracking from .usage.json in the skills directory."""
    path = get_anakot_home() / "skills" / ".usage.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _to_int_ts(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        s = str(value).strip()
        if not s:
            return None
        try:
            return int(float(s))
        except ValueError:
            parsed = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp())
    except Exception:
        return None


def _usage_timestamp(rec: dict[str, Any]) -> Optional[int]:
    for key in ("last_activity_at", "last_used_at", "last_viewed_at", "last_patched_at", "created_at"):
        ts = _to_int_ts(rec.get(key))
        if ts is not None:
            return ts
    return None


def build_skill_nodes(skill_roots: list[tuple[str, Path]]) -> dict[str, SkillNode]:
    usage = _load_usage()
    nodes: dict[str, SkillNode] = {}

    for source, skill_md in _iter_skill_files(skill_roots):
        if any(p in {".archive", ".hub", "node_modules", ".git"} for p in skill_md.parts):
            continue
        try:
            fm, _ = parse_frontmatter(skill_md.read_text(encoding="utf-8")[:4000])
        except OSError:
            continue
        if not isinstance(fm, dict):
            continue
        name = str(fm.get("name") or skill_md.parent.name).strip()
        if not name or name in nodes:
            continue
        rec = usage.get(name, {})
        last_activity = _usage_timestamp(rec)
        file_ts = _to_int_ts(skill_md.stat().st_mtime)
        nodes[name] = SkillNode(
            name=name,
            category=_category(fm, skill_md),
            source=source,
            timestamp=last_activity or file_ts,
            use_count=int(rec.get("use_count", 0) or 0),
            state=str(rec.get("state", "active") or "active"),
            created_by=rec.get("created_by"),
            pinned=bool(rec.get("pinned", False)),
            related=_related(fm),
        )
    return nodes


def build_edges(nodes: dict[str, SkillNode]) -> list[tuple[str, str]]:
    """Undirected related_skills edges where BOTH endpoints exist (deduped)."""
    seen: set[tuple[str, str]] = set()
    edges: list[tuple[str, str]] = []
    for node in nodes.values():
        for target in node.related:
            if target in nodes and target != node.name:
                a, b = sorted((node.name, target))
                key = (a, b)
                if key not in seen:
                    seen.add(key)
                    edges.append(key)
    return edges


def _memory_cards() -> list[dict[str, Any]]:
    """Freeform memory as readable cards.

    MEMORY.md / USER.md are prose split on bare § separators; each chunk
    becomes one card. Every chunk is surfaced — the graph shows everything.
    """
    base = get_anakot_home() / "memories"
    cards: list[dict[str, Any]] = []

    for source in ("MEMORY.md", "USER.md"):
        path = base / source
        if not path.exists():
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError:
            continue
        file_mtime = int(path.stat().st_mtime)
        chunks = [c.strip() for c in raw.split("\u00a7") if c.strip()]
        for idx, chunk in enumerate(chunks):
            lines = chunk.split("\n", 1)
            title = lines[0].strip()[:80]
            body = (lines[1] if len(lines) > 1 else lines[0]).strip()[:1200]
            card_id = f"memory:{source.replace('.md','').lower()}:{idx}"
            cards.append({
                "id": card_id,
                "source": source.replace(".md", "").lower(),
                "timestamp": file_mtime + idx,  # spread sequential chunks
                "title": title,
                "body": body,
            })

    return cards


def _lexical_memory_edges(
    memory_cards: list[dict[str, Any]],
    skill_nodes: dict[str, SkillNode],
) -> list[tuple[str, str]]:
    """Link memory cards to skills that overlap in token content."""
    skill_names = list(skill_nodes)
    if not skill_names:
        return []

    skill_tokens: dict[str, set[str]] = {}
    for name in skill_names:
        # Tokenise skill name into 3+ char alphanumeric runs
        tokens = set(re.findall(r"[A-Za-z0-9_]{3,}", name.lower()))
        skill_tokens[name] = tokens

    edges: list[tuple[str, str]] = []
    for card in memory_cards:
        text = (card.get("title", "") + " " + card.get("body", "")).lower()
        scores: list[tuple[str, int]] = []
        for name, tokens in skill_tokens.items():
            score = 0
            name_lower = name.lower()
            if name_lower in text:
                score += 6
            # Overlapping tokens
            for tok in tokens:
                if tok in text:
                    score += 1
            if score > 0:
                scores.append((name, score))
        scores.sort(key=lambda x: -x[1])
        for name, _ in scores[:4]:
            edges.append((card["id"], name))

    return edges


def build_learning_graph() -> dict[str, Any]:
    """Build and return the full StarmapGraph as a serializable dict."""
    home = get_anakot_home()
    skill_roots: list[tuple[str, Path]] = [
        ("profile", home / "skills"),
        ("base", Path(__file__).parent.parent / "skills"),
    ]

    # --- Skill nodes ---
    all_skills = build_skill_nodes(skill_roots)
    # Only include learned/profile skills (non-base, agent-created or used)
    learned_nodes = {
        name: node
        for name, node in all_skills.items()
        if node.source != "base" or node.use_count > 0
    }
    # But also include profile skills
    profile_nodes = {
        name: node
        for name, node in all_skills.items()
        if node.source == "profile"
    }
    # Merge: profile overrides base
    skill_nodes = {**learned_nodes, **profile_nodes}

    # --- Skill edges ---
    skill_skill_edges = build_edges(skill_nodes)

    # --- Memory cards ---
    memory_cards = _memory_cards()

    # --- Memory→skill edges ---
    memory_skill_edges = _lexical_memory_edges(memory_cards, skill_nodes)

    # --- Build node list ---
    nodes: list[dict[str, Any]] = []
    for name, node in skill_nodes.items():
        nodes.append({
            "id": name,
            "label": name,
            "kind": "skill",
            "timestamp": node.timestamp,
            "category": node.category,
            "useCount": node.use_count,
            "state": node.state,
            "createdBy": node.created_by,
            "pinned": node.pinned,
        })

    for card in memory_cards:
        node_id = card["id"]
        nodes.append({
            "id": node_id,
            "label": card["title"],
            "kind": "memory",
            "memorySource": card["source"],
            "timestamp": card["timestamp"],
            "category": "memory",
            "useCount": 0,
            "state": "active",
            "createdBy": None,
            "pinned": False,
        })

    # --- Build edges list ---
    edges: list[dict[str, str]] = []
    for a, b in skill_skill_edges:
        edges.append({"source": a, "target": b})
    for a, b in memory_skill_edges:
        edges.append({"source": a, "target": b})

    # --- Clusters ---
    cat_counts: dict[str, int] = {}
    for n in skill_nodes.values():
        cat_counts[n.category] = cat_counts.get(n.category, 0) + 1
    clusters = [{"category": cat, "count": cnt} for cat, cnt in cat_counts.items()]

    # --- Stats ---
    linked: set[str] = set()
    for e in edges:
        linked.add(e["source"])
        linked.add(e["target"])

    stats = {
        "nodes": len(nodes),
        "edges": len(edges),
        "memories": len(memory_cards),
        "skills": len(skill_nodes),
        "linked_nodes": len(linked),
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "clusters": clusters,
        "memory": memory_cards,
        "stats": stats,
    }


if __name__ == "__main__":
    import json
    graph = build_learning_graph()
    print(json.dumps(graph, indent=2, default=str)[:2000])
    print(f"\n--- Stats ---")
    for k, v in graph["stats"].items():
        print(f"  {k}: {v}")
