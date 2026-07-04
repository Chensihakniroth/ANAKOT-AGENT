"""
Obsidian Knowledge Graph Tool

Scans a markdown vault for [[WikiLink]] references and produces
a force-directed graph data structure for visualization.

This is the Python equivalent of apps/desktop/src/lib/obsidian-graph.ts
for use in the main Anakot Agent (CLI/TUI/Gateway).
"""

import os
import re
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from tools.registry import registry


# Regex patterns matching the TypeScript implementation
WIKI_LINK_REGEX = re.compile(r'\[\[([^\]]+)(?:\|[^\]]+)?\]\]')
FRONTMATTER_TITLE_REGEX = re.compile(r'^---\s*\n[\s\S]*?title:\s*["\']?([^"\'\n]+?)["\']?\n[\s\S]*?---', re.MULTILINE)


def normalize_obsidian_link_target(raw_target: str) -> str:
    """Normalize an Obsidian wikilink target to a comparable form."""
    if not raw_target:
        return ''
    target = raw_target.strip()
    if not target:
        return ''
    
    # Remove section anchors (#heading)
    target = target.split('#')[0].strip()
    # Remove display text aliases (|alias)
    target = target.split('|')[0].strip()
    # Remove leading ./ or /
    target = target.replace('./', '').replace('/', '', 1) if target.startswith('/') else target
    # Normalize backslashes
    target = target.replace('\\', '/')
    # Remove .md extension
    target = re.sub(r'\.md$', '', target, flags=re.IGNORECASE)
    return target


def resolve_obsidian_link_target(raw_target: str, known_ids: Set[str]) -> Optional[str]:
    """Resolve a wikilink target to a known note ID."""
    normalized = normalize_obsidian_link_target(raw_target)
    if not normalized:
        return None
    
    # Exact match
    if normalized in known_ids:
        return normalized
    
    # Try matching by basename (filename without path)
    basename = normalized.split('/')[-1] if '/' in normalized else normalized
    for note_id in known_ids:
        note_basename = note_id.split('/')[-1] if '/' in note_id else note_id
        if note_basename == basename or note_id == basename:
            return note_id
    
    return None


def scan_vault(root_path: str) -> Dict[str, Any]:
    """
    Synchronously scan a vault directory for notes and wikilinks.
    Returns a graph data structure ready for force-directed rendering.
    
    Returns:
        {
            "ok": bool,
            "rootPath": str,
            "graph": {
                "nodes": [...],
                "links": [...]
            },
            "error": str (if ok=False)
        }
    """
    try:
        root = Path(root_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            return {
                "ok": False,
                "rootPath": str(root),
                "error": "vault path not found",
                "graph": {"nodes": [], "links": []}
            }
        
        nodes: List[Dict[str, Any]] = []
        links: List[Dict[str, str]] = []
        note_entries: List[Dict[str, Any]] = []
        link_counts: Dict[str, int] = {}
        
        def scan_dir(dir_path: Path, group: str):
            try:
                entries = sorted(dir_path.iterdir(), key=lambda e: e.name)
            except (PermissionError, OSError):
                return
            
            for entry in entries:
                # Skip hidden directories (.obsidian, .git, etc.)
                if entry.name.startswith('.'):
                    continue
                
                if entry.is_dir():
                    scan_dir(entry, entry.name)
                    continue
                
                if entry.suffix.lower() != '.md':
                    continue
                
                try:
                    relative_path = entry.relative_to(root).as_posix()
                    note_id = relative_path[:-3]  # Remove .md
                    content = entry.read_text(encoding='utf-8')
                except (OSError, UnicodeDecodeError):
                    continue
                
                # Extract title from YAML frontmatter
                name = note_id.split('/')[-1] if '/' in note_id else note_id
                fm_match = FRONTMATTER_TITLE_REGEX.search(content)
                if fm_match:
                    name = fm_match.group(1).strip()
                
                note_entries.append({
                    "id": note_id,
                    "name": name,
                    "path": str(entry),
                    "group": group or "root",
                    "content": content
                })
        
        scan_dir(root, '')
        
        # Build set of known note IDs for link resolution
        note_ids = {note["id"] for note in note_entries}
        
        # Process each note for wikilinks
        for note in note_entries:
            targets = set()
            
            for match in WIKI_LINK_REGEX.finditer(note["content"]):
                target = normalize_obsidian_link_target(match.group(1))
                if not target:
                    continue
                
                resolved = resolve_obsidian_link_target(target, note_ids)
                if not resolved or resolved == note["id"]:
                    continue
                
                targets.add(resolved)
                link_counts[resolved] = link_counts.get(resolved, 0) + 1
            
            nodes.append({
                "id": note["id"],
                "name": note["name"],
                "path": note["path"],
                "group": note["group"],
                "size": 0  # Will be calculated below
            })
            
            for target in targets:
                links.append({"source": note["id"], "target": target})
        
        # Calculate node sizes based on total connections (incoming + outgoing)
        for node in nodes:
            outgoing = sum(1 for l in links if l["source"] == node["id"])
            incoming = link_counts.get(node["id"], 0)
            # Size range 4-20, scaled by connection count
            node["size"] = max(4, min(20, (outgoing + incoming) * 2))
        
        return {
            "ok": True,
            "rootPath": str(root),
            "graph": {"nodes": nodes, "links": links}
        }
    
    except Exception as e:
        return {
            "ok": False,
            "rootPath": root_path,
            "error": str(e),
            "graph": {"nodes": [], "links": []}
        }


def obsidian_graph_scan(vault_path: str, task_id: str = None) -> str:
    """
    Scan an Obsidian vault and return graph data as JSON string.
    
    Args:
        vault_path: Path to the Obsidian vault directory
        task_id: Optional task ID for tracking
    
    Returns:
        JSON string with graph data or error
    """
    result = scan_vault(vault_path)
    return json.dumps(result)


def check_obsidian_graph_requirements() -> bool:
    """Check if the tool requirements are met (always true for this tool)."""
    return True


# Register the tool
registry.register(
    name="obsidian_graph_scan",
    toolset="obsidian",
    schema={
        "name": "obsidian_graph_scan",
        "description": "Scan an Obsidian vault for markdown notes and [[WikiLink]] connections, returning a force-directed graph data structure for visualization.",
        "parameters": {
            "type": "object",
            "properties": {
                "vault_path": {
                    "type": "string",
                    "description": "Path to the Obsidian vault directory. If not provided, uses OBSIDIAN_VAULT_PATH env var or ~/.config/obsidian/vault."
                }
            },
            "required": ["vault_path"]
        }
    },
    handler=lambda args, **kw: obsidian_graph_scan(
        vault_path=args.get("vault_path", ""),
        task_id=kw.get("task_id")
    ),
    check_fn=check_obsidian_graph_requirements,
    requires_env=[],
)