"""
NotebookLLM — Document notebook storage and management.

Stores notebooks at ~/.anakot/notebooks/<user_id>/<notebook_id>/ with:
  - sources/        uploaded files
  - metadata.db     SQLite DB for notebook + source metadata
  - extracted/      extracted text from documents

Scope: each notebook is scoped to a user_id. When user_id is None (loopback / no-auth
mode), the shared scope "_shared" is used. Legacy notebooks stored directly under
notebooks/<id>/ are migrated into the shared scope on access.
"""

import json
import logging
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from anakot_cli.config import get_anakot_home

_log = logging.getLogger(__name__)

_SHARED = "_shared"

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


def _user_scope(user_id: str | None) -> str:
    """Return the directory scope for *user_id* (None → shared scope)."""
    return user_id if user_id else _SHARED


def _notebooks_root(user_id: str | None = None) -> Path:
    """Return the root directory for all notebooks scoped to *user_id*."""
    root = get_anakot_home() / "notebooks" / _user_scope(user_id)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _notebook_dir(notebook_id: str, user_id: str | None = None) -> Path:
    """Return the directory for a specific notebook, scoped by *user_id*."""
    d = _notebooks_root(user_id) / notebook_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "sources").mkdir(exist_ok=True)
    (d / "extracted").mkdir(exist_ok=True)
    return d


def _db_path(notebook_id: str, user_id: str | None = None) -> Path:
    return _notebook_dir(notebook_id, user_id) / "metadata.db"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _get_db(notebook_id: str, user_id: str | None = None) -> sqlite3.Connection:
    db = sqlite3.connect(str(_db_path(notebook_id, user_id)))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    return db


def _init_db(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS notebook (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled Notebook',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS source (
            id TEXT PRIMARY KEY,
            notebook_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            file_path TEXT,
            url TEXT,
            page_count INTEGER DEFAULT 0,
            word_count INTEGER DEFAULT 0,
            char_count INTEGER DEFAULT 0,
            extracted_text TEXT,
            summary TEXT,
            metadata_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (notebook_id) REFERENCES notebook(id)
        );
        CREATE INDEX IF NOT EXISTS idx_source_notebook ON source(notebook_id);
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notebook_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (notebook_id) REFERENCES notebook(id)
        );
        CREATE INDEX IF NOT EXISTS idx_chat_notebook ON chat_history(notebook_id);
    """
    )
    db.commit()
    # Migration: add sort_order column for source ordering (safe to fail if already exists)
    try:
        db.execute("ALTER TABLE source ADD COLUMN sort_order INTEGER DEFAULT 0")
        db.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Migration: add pinned column for notebook pinning (safe to fail if already exists)
    try:
        db.execute("ALTER TABLE notebook ADD COLUMN pinned INTEGER DEFAULT 0")
        db.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists


# ---------------------------------------------------------------------------
# Legacy migration (one-time)
# ---------------------------------------------------------------------------


def _migrate_legacy_notebooks(user_id: str | None) -> None:
    """One-time migration: move notebooks from notebooks/<id>/ into notebooks/<scope>/<id>/.

    Only runs once per scope — the first time any notebook operation is called
    for that user. Legacy notebooks are moved, not copied (safe).
    """
    scope = _user_scope(user_id)
    scope_dir = _notebooks_root(user_id)
    legacy_root = get_anakot_home() / "notebooks"

    legacy_root.mkdir(parents=True, exist_ok=True)

    # Sentinel: if there's a scope subdirectory, migration already ran for this scope
    sentinel = scope_dir / ".migrated"
    if sentinel.exists():
        return

    migrated_any = False
    for d in sorted(legacy_root.iterdir()):
        if not d.is_dir():
            continue
        # Skip scope directories and the sentinel
        if d.name.startswith("_"):
            continue
        # Check if it looks like a notebook dir (has metadata.db)
        if not (d / "metadata.db").exists():
            continue
        # Move it into the scope
        dst = scope_dir / d.name
        try:
            d.rename(dst)
            _log.info("Migrated legacy notebook '%s' into scope '%s'", d.name, scope)
            migrated_any = True
        except OSError:
            _log.warning("Could not move legacy notebook '%s', copying instead", d.name)
            import shutil
            shutil.copytree(d, dst, dirs_exist_ok=True)

    # Mark as migrated
    sentinel.write_text(datetime.now(timezone.utc).isoformat())

    # Also clean up empty old directories (only if they're truly empty)
    if migrated_any:
        _cleanup_legacy_dir(legacy_root)


def _cleanup_legacy_dir(legacy_root: Path) -> None:
    """Remove empty dirs under the legacy root."""
    for d in sorted(legacy_root.iterdir(), reverse=True):
        if d.is_dir() and not d.name.startswith("_"):
            try:
                if not any(d.iterdir()):
                    d.rmdir()
            except OSError:
                pass
    # Remove the legacy root itself if it's empty
    try:
        if not any(legacy_root.iterdir()):
            legacy_root.rmdir()
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Notebook CRUD
# ---------------------------------------------------------------------------


def create_notebook(title: str = "Untitled Notebook", user_id: str | None = None) -> Dict[str, Any]:
    _migrate_legacy_notebooks(user_id)
    notebook_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    db.execute(
        "INSERT INTO notebook (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (notebook_id, title, now, now),
    )
    db.commit()
    db.close()
    return {"id": notebook_id, "title": title, "created_at": now, "updated_at": now}


def list_notebooks(user_id: str | None = None) -> List[Dict[str, Any]]:
    _migrate_legacy_notebooks(user_id)
    notebooks: List[Dict[str, Any]] = []
    root = _notebooks_root(user_id)
    for d in root.iterdir():
        if d.is_dir() and (d / "metadata.db").exists():
            db = _get_db(d.name, user_id)
            _init_db(db)
            row = db.execute(
                "SELECT * FROM notebook WHERE id = ?", (d.name,)
            ).fetchone()
            if row:
                source_count = db.execute(
                    "SELECT COUNT(*) as cnt FROM source WHERE notebook_id = ?",
                    (d.name,),
                ).fetchone()["cnt"]
                source_names = [
                    r[0]
                    for r in db.execute(
                        "SELECT original_name FROM source WHERE notebook_id = ? ORDER BY sort_order",
                        (d.name,),
                    ).fetchall()
                ]
                notebooks.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "source_count": source_count,
                        "source_names": source_names,
                        "pinned": bool(row["pinned"]),
                    }
                )
            db.close()
    notebooks.sort(key=lambda n: n["updated_at"], reverse=True)
    return notebooks


def get_notebook(notebook_id: str, user_id: str | None = None) -> Optional[Dict[str, Any]]:
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    row = db.execute(
        "SELECT * FROM notebook WHERE id = ?", (notebook_id,)
    ).fetchone()
    if not row:
        db.close()
        return None
    sources = db.execute(
        "SELECT id, filename, original_name, source_type, page_count, "
        "word_count, char_count, summary, created_at "
        "FROM source WHERE notebook_id = ? ORDER BY sort_order, created_at",
        (notebook_id,),
    ).fetchall()
    db.close()
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "pinned": bool(row["pinned"]),
        "sources": [dict(s) for s in sources],
    }


def set_notebook_pinned(notebook_id: str, pinned: bool, user_id: str | None = None) -> bool:
    """Pin or unpin a notebook. Returns True if the notebook exists."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    cur = db.execute(
        "UPDATE notebook SET pinned = ? WHERE id = ?",
        (1 if pinned else 0, notebook_id),
    )
    db.commit()
    changed = cur.rowcount > 0
    db.close()
    return changed


def delete_notebook(notebook_id: str, user_id: str | None = None) -> bool:
    nb_dir = _notebooks_root(user_id) / notebook_id
    if not nb_dir.exists():
        return False
    import shutil

    shutil.rmtree(nb_dir, ignore_errors=True)
    return True


def duplicate_notebook(notebook_id: str, title: str | None = None, user_id: str | None = None) -> Dict[str, Any] | None:
    """Duplicate a notebook with all its sources (copies files, creates new DB)."""
    import shutil

    src_dir = _notebooks_root(user_id) / notebook_id
    if not src_dir.exists():
        return None

    src_db = _get_db(notebook_id, user_id)
    _init_db(src_db)
    src_row = src_db.execute("SELECT * FROM notebook WHERE id = ?", (notebook_id,)).fetchone()
    if not src_row:
        src_db.close()
        return None

    new_id = uuid.uuid4().hex[:12]
    new_title = title or f"{src_row['title']} (copy)"
    now = datetime.now(timezone.utc).isoformat()
    new_dir = _notebook_dir(new_id, user_id)

    # Copy source files and extracted text
    src_sources = src_db.execute(
        "SELECT * FROM source WHERE notebook_id = ? ORDER BY sort_order", (notebook_id,)
    ).fetchall()
    src_db.close()

    for src in src_sources:
        src_file = src_dir / "sources" / src["filename"]
        dst_file = new_dir / "sources" / src["filename"]
        if src_file.exists():
            shutil.copy2(src_file, dst_file)
        src_extracted = src_dir / "extracted" / f"{src['id']}.txt"
        dst_extracted = new_dir / "extracted" / f"{src['id']}.txt"
        if src_extracted.exists():
            shutil.copy2(src_extracted, dst_extracted)

    # Create new DB
    new_db = _get_db(new_id, user_id)
    _init_db(new_db)
    new_db.execute(
        "INSERT INTO notebook (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (new_id, new_title, now, now),
    )

    for src in src_sources:
        new_db.execute(
            """INSERT INTO source (id, notebook_id, filename, original_name, source_type, url,
               page_count, word_count, char_count, summary, sort_order, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (src["id"], new_id, src["filename"], src["original_name"], src["source_type"],
             src["url"], src["page_count"], src["word_count"], src["char_count"],
             src["summary"], src["sort_order"], now),
        )

    new_db.commit()
    new_db.close()

    return {"id": new_id, "title": new_title, "source_count": len(src_sources), "created_at": now, "updated_at": now}


def rename_notebook(notebook_id: str, title: str, user_id: str | None = None) -> bool:
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    now = datetime.now(timezone.utc).isoformat()
    cur = db.execute(
        "UPDATE notebook SET title = ?, updated_at = ? WHERE id = ?",
        (title, now, notebook_id),
    )
    db.commit()
    changed = cur.rowcount > 0
    db.close()
    return changed


# ---------------------------------------------------------------------------
# Source CRUD
# ---------------------------------------------------------------------------


def add_source(
    notebook_id: str,
    filename: str,
    original_name: str,
    source_type: str,
    content_bytes: bytes,
    extracted_text: str = "",
    page_count: int = 0,
    word_count: int = 0,
    char_count: int = 0,
    url: str = "",
    metadata_json: str = "",
    user_id: str | None = None,
) -> Dict[str, Any]:
    source_id = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc).isoformat()

    nb_dir = _notebook_dir(notebook_id, user_id)
    file_path = nb_dir / "sources" / filename
    file_path.write_bytes(content_bytes)

    if extracted_text:
        ext_path = nb_dir / "extracted" / f"{source_id}.txt"
        ext_path.write_text(extracted_text, encoding="utf-8")

    db = _get_db(notebook_id, user_id)
    _init_db(db)
    db.execute(
        """INSERT INTO source
           (id, notebook_id, filename, original_name, source_type, file_path,
            url, page_count, word_count, char_count, extracted_text, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            source_id,
            notebook_id,
            filename,
            original_name,
            source_type,
            str(file_path),
            url,
            page_count,
            word_count,
            char_count,
            extracted_text,
            metadata_json,
            now,
        ),
    )
    db.execute(
        "UPDATE notebook SET updated_at = ? WHERE id = ?", (now, notebook_id)
    )
    db.commit()
    db.close()

    return {
        "id": source_id,
        "filename": filename,
        "original_name": original_name,
        "source_type": source_type,
        "page_count": page_count,
        "word_count": word_count,
        "char_count": char_count,
        "created_at": now,
    }


def get_source(notebook_id: str, source_id: str, user_id: str | None = None) -> Optional[Dict[str, Any]]:
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    row = db.execute(
        "SELECT * FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    db.close()
    if not row:
        return None
    return dict(row)


def get_source_text(notebook_id: str, source_id: str, user_id: str | None = None) -> Optional[str]:
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    row = db.execute(
        "SELECT extracted_text FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    db.close()
    return row["extracted_text"] if row else None


def update_source_summary(
    notebook_id: str, source_id: str, summary: str, user_id: str | None = None
) -> bool:
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    cur = db.execute(
        "UPDATE source SET summary = ? WHERE id = ? AND notebook_id = ?",
        (summary, source_id, notebook_id),
    )
    db.commit()
    changed = cur.rowcount > 0
    db.close()
    return changed


def delete_source(notebook_id: str, source_id: str, user_id: str | None = None) -> bool:
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    row = db.execute(
        "SELECT file_path FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    if not row:
        db.close()
        return False

    fp = Path(row["file_path"])
    if fp.exists():
        fp.unlink()

    ext_path = _notebook_dir(notebook_id, user_id) / "extracted" / f"{source_id}.txt"
    if ext_path.exists():
        ext_path.unlink()

    db.execute(
        "DELETE FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    )
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE notebook SET updated_at = ? WHERE id = ?", (now, notebook_id)
    )
    db.commit()
    db.close()
    return True


def reorder_sources(notebook_id: str, source_ids: list[str], user_id: str | None = None) -> list[dict]:
    """Reorder sources for a notebook by setting sort_order values."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)

    existing = db.execute(
        "SELECT id FROM source WHERE notebook_id = ?",
        (notebook_id,),
    ).fetchall()
    existing_ids = {row["id"] for row in existing}

    valid_ids = [sid for sid in source_ids if sid in existing_ids]
    remaining = [sid for sid in existing_ids if sid not in set(valid_ids)]
    ordered_ids = valid_ids + remaining

    for idx, source_id in enumerate(ordered_ids):
        db.execute(
            "UPDATE source SET sort_order = ? WHERE id = ? AND notebook_id = ?",
            (idx, source_id, notebook_id),
        )

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE notebook SET updated_at = ? WHERE id = ?", (now, notebook_id)
    )
    db.commit()

    rows = db.execute(
        "SELECT id, filename, original_name, source_type, page_count, "
        "word_count, char_count, summary, created_at "
        "FROM source WHERE notebook_id = ? ORDER BY sort_order, created_at",
        (notebook_id,),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


def get_all_extracted_text(
    notebook_id: str, max_chars: int = 100_000, user_id: str | None = None
) -> str:
    """Get combined extracted text from all sources, truncated to max_chars."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    rows = db.execute(
        "SELECT filename, extracted_text, source_type FROM source "
        "WHERE notebook_id = ? AND extracted_text IS NOT NULL "
        "ORDER BY sort_order, created_at",
        (notebook_id,),
    ).fetchall()
    db.close()

    parts: list[str] = []
    total = 0
    for idx, row in enumerate(rows):
        text = row["extracted_text"] or ""
        if not text.strip():
            continue
        header = f"\n--- Source: {row['filename']} ---\n"
        remaining = max_chars - total - len(header)
        if remaining <= 0:
            break
        truncated = text[:remaining]
        parts.append(header + truncated)
        total += len(header) + len(truncated)

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Retrieval: chunking + relevance ranking
# ---------------------------------------------------------------------------

_NB_CHUNK_SIZE = 1400
_NB_CHUNK_OVERLAP = 200

_NB_STOPWORDS = frozenset(
    """a about after again all also am an and any are as at be because been before being
    between both but by can could did do does doing down during each few for from further
    had has have having he her here hers him his how i if in into is it its itself just
    me more most my no nor not of off on or other our ours out over own same she should so
    some such than that the their theirs them then there these they this those through to
    too under until up very was we were what when where which while who whom why will with
    you your yours""".split()
)


def chunk_text(
    text: str,
    chunk_size: int = _NB_CHUNK_SIZE,
    overlap: int = _NB_CHUNK_OVERLAP,
) -> List[str]:
    """Split *text* into overlapping chunks for retrieval.

    Chunks prefer to end on a newline boundary (paragraph break) when one
    exists in the back half of the window; long unbroken runs are hard-split.
    Returns a list of non-empty chunks.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        if end < n:
            # Prefer breaking at a paragraph/newline boundary in the latter
            # half of the window so chunks stay readable.
            cut = text.rfind("\n", start + chunk_size // 2, end)
            if cut > start:
                end = cut
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def tokenize(text: str) -> List[str]:
    """Lowercase alphanumeric tokens minus a small English stopword list."""
    import re

    return [
        t
        for t in re.findall(r"[a-z0-9]+", text.lower())
        if len(t) > 1 and t not in _NB_STOPWORDS
    ]


def rank_chunks(query: str, chunks: List[tuple]) -> List[tuple]:
    """BM25-lite ranking of ``(source_index, chunk_text)`` pairs vs *query*.

    Returns the same list with a float score appended to each tuple:
    ``(source_index, chunk_text, score)``. Scores are corpus-relative (idf is
    computed over the chunk set), so only ordering is meaningful. A query with
    no meaningful terms scores everything 0.
    """
    import math
    from collections import Counter

    q_terms = tokenize(query)
    scored = [(si, c, 0.0) for si, c in chunks]
    if not q_terms or not chunks:
        return scored

    n = len(chunks)
    doc_tokens = [tokenize(c) for _, c in chunks]
    df: Counter = Counter()
    for toks in doc_tokens:
        for t in set(toks):
            df[t] += 1
    avgdl = max(1.0, sum(len(t) for t in doc_tokens) / n)
    k1, b = 1.5, 0.75

    out: List[tuple] = []
    for (si, c), toks in zip(chunks, doc_tokens):
        dl = Counter(toks)
        doc_len = len(toks)
        score = 0.0
        for t in q_terms:
            tf = dl.get(t)
            if not tf:
                continue
            idf = math.log(1.0 + (n - df[t] + 0.5) / (df[t] + 0.5))
            score += idf * (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * doc_len / avgdl))
        out.append((si, c, score))
    return out


def get_source_texts(
    notebook_id: str, user_id: str | None = None
) -> List[Dict[str, Any]]:
    """Ordered extracted texts of a notebook's sources.

    Order matches ``get_notebook()['sources']`` (sort_order, created_at) so a
    source's position in the returned list is its ``[Source N]`` number - 1.
    """
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    rows = db.execute(
        "SELECT id, filename, extracted_text FROM source "
        "WHERE notebook_id = ? AND extracted_text IS NOT NULL "
        "ORDER BY sort_order, created_at",
        (notebook_id,),
    ).fetchall()
    db.close()
    return [
        {"id": r["id"], "filename": r["filename"], "text": r["extracted_text"] or ""}
        for r in rows
    ]


def build_chat_context(
    notebook_id: str,
    message: str,
    user_id: str | None = None,
    max_chars: int = 50_000,
    source_id: str | None = None,
    source_ids: list[str] | None = None,
) -> Optional[Tuple[str, str]]:
    """Build a retrieval-aware context block for notebook chat.

    Chunks every source, BM25-ranks the passages against *message*, and spends
    the *max_chars* budget on the most relevant passages (capped at 60% per
    source so one document can't monopolize the window). Each passage is
    labeled ``--- Source N: <filename> ---`` where N is the 1-indexed position
    in ``get_notebook()['sources']`` — the same numbering the frontend uses for
    ``[Source N]`` citations.

    Scoping: ``source_ids`` (a list) restricts retrieval to those specific
    sources (union) — the multi-source "scope to selected sources" mode.
    ``source_id`` (single, legacy) restricts to one source and is ignored when
    ``source_ids`` is provided. Either way the labels keep each source's
    ORIGINAL position in the notebook so citations stay consistent with the
    source list the frontend renders.

    Global questions ("summarize this notebook") have no useful query terms, so
    they fall back to an even per-source spread instead of top-k ranking.

    Returns ``(context_text, note)`` — *note* is a transparency string ("" when
    nothing was dropped). Returns ``(None, None)`` when the notebook has no
    extractable text.
    """
    all_sources = [s for s in get_source_texts(notebook_id, user_id) if s["text"].strip()]
    if not all_sources:
        return None, None

    # Resolve the scoped subset, preserving original source order.
    scoped_idx: list[int] | None = None
    if source_ids:
        wanted = set(source_ids)
        scoped_idx = [i for i, s in enumerate(all_sources) if s["id"] in wanted]
        if not scoped_idx:
            scoped_idx = None  # no ids matched → fall back to all sources
    elif source_id:
        matched = next(
            (i for i, s in enumerate(all_sources) if s["id"] == source_id),
            None,
        )
        if matched is not None:
            scoped_idx = [matched]

    if scoped_idx is None:
        scoped_idx = list(range(len(all_sources)))
    sources = [all_sources[i] for i in scoped_idx]
    # Map each scoped source to its ORIGINAL 1-indexed position so [Source N]
    # citations in the frontend keep matching the full source list.
    orig_pos = {si: scoped_idx[si] + 1 for si in range(len(sources))}

    chunks: List[tuple] = []
    for si, s in enumerate(sources):
        for c in chunk_text(s["text"]):
            chunks.append((si, c))

    ranked = rank_chunks(message, chunks)
    ranked.sort(key=lambda x: x[2], reverse=True)
    has_matches = ranked and ranked[0][2] > 0

    if not has_matches:
        # No meaningful query (or nothing matched): even per-source spread so
        # global questions still see the whole notebook.
        budget_per = max(max_chars // len(sources), 1)
        parts = []
        for si, s in enumerate(sources):
            text = s["text"]
            if len(text) > budget_per:
                text = text[:budget_per] + "\n\n[...truncated...]"
            parts.append(f"--- Source {orig_pos[si]}: {s['filename']} ---\n{text}")
        return "\n\n".join(parts), ""

    # Ranked selection with a per-source cap so one document can't eat the
    # whole window.
    per_source_budget = int(max_chars * 0.6)
    parts = []
    used = 0
    src_used: Dict[int, int] = {}
    omitted = 0
    for si, c, _score in ranked:
        block = f"--- Source {orig_pos[si]}: {sources[si]['filename']} ---\n{c}"
        if used + len(block) > max_chars:
            omitted += 1
            continue
        if src_used.get(si, 0) + len(block) > per_source_budget:
            omitted += 1
            continue
        parts.append(block)
        used += len(block)
        src_used[si] = src_used.get(si, 0) + len(block)
    if not parts and ranked:
        si, c, _ = ranked[0]
        parts.append(f"--- Source {orig_pos[si]}: {sources[si]['filename']} ---\n{c}")
    note = (
        f"\n\n[Note: {omitted} of {len(chunks)} passages omitted as less "
        "relevant to the query.]"
        if omitted
        else ""
    )
    return "\n\n".join(parts), note


# ---------------------------------------------------------------------------
# Chat history
# ---------------------------------------------------------------------------


def save_chat_message(
    notebook_id: str, role: str, content: str, user_id: str | None = None
) -> int:
    """Append a chat message and return its id.

    Keeps only the last 200 messages per notebook.
    """
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    now = datetime.now(timezone.utc).isoformat()
    cur = db.execute(
        "INSERT INTO chat_history (notebook_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (notebook_id, role, content, now),
    )
    db.commit()
    msg_id = cur.lastrowid

    # Prune old messages — keep only last 200
    db.execute(
        """DELETE FROM chat_history WHERE notebook_id = ? AND id NOT IN (
            SELECT id FROM chat_history WHERE notebook_id = ? ORDER BY id DESC LIMIT 200
        )""",
        (notebook_id, notebook_id),
    )
    db.commit()

    db.close()
    return msg_id


def clear_chat_history(notebook_id: str, user_id: str | None = None) -> None:
    """Clear all chat history for a notebook."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    db.execute("DELETE FROM chat_history WHERE notebook_id = ?", (notebook_id,))
    db.commit()
    db.close()


def truncate_chat_history(notebook_id: str, keep: int, user_id: str | None = None) -> int:
    """Trim a notebook's chat history to the *keep* oldest messages.

    Returns the number of messages deleted. ``keep <= 0`` clears everything
    (same as :func:`clear_chat_history`). Used when the user edits/re-sends or
    regenerates a message so the SQLite history matches the trimmed UI thread
    instead of resurrecting deleted messages on the next open.
    """
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    if keep <= 0:
        db.execute("DELETE FROM chat_history WHERE notebook_id = ?", (notebook_id,))
        deleted = db.total_changes
    else:
        cur = db.execute(
            """DELETE FROM chat_history WHERE notebook_id = ? AND id NOT IN (
                SELECT id FROM chat_history WHERE notebook_id = ? ORDER BY id ASC LIMIT ?
            )""",
            (notebook_id, notebook_id, keep),
        )
        deleted = cur.rowcount
    db.commit()
    db.close()
    return deleted


def rename_source(notebook_id: str, source_id: str, new_name: str, user_id: str | None = None) -> bool:
    """Update a source's original_name."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    cur = db.execute(
        "UPDATE source SET original_name = ? WHERE id = ? AND notebook_id = ?",
        (new_name, source_id, notebook_id),
    )
    db.commit()
    changed = cur.rowcount > 0
    db.close()
    return changed


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


def extract_pdf_text(file_path: str) -> tuple[str, int]:
    """Extract text from a PDF file. Returns (text, page_count)."""
    try:
        import pymupdf

        doc = pymupdf.open(file_path)
        pages = []
        for page in doc:
            pages.append(page.get_text())
        page_count = doc.page_count
        doc.close()
        return "\n\n".join(pages), page_count
    except ImportError:
        _log.warning("pymupdf not installed — cannot extract PDF text")
        return "", 0
    except Exception as e:
        _log.error(f"PDF extraction failed: {e}")
        return "", 0


def extract_text_content(content: str) -> tuple[str, int]:
    """For plain text files, return as-is with word count as 'page count'."""
    words = len(content.split())
    return content, max(1, words // 300)  # ~300 words per "page"


def load_chat_history(
    notebook_id: str, limit: int = 200, user_id: str | None = None
) -> list[dict]:
    """Return recent chat messages, newest first (caller reverses)."""
    _migrate_legacy_notebooks(user_id)
    db = _get_db(notebook_id, user_id)
    _init_db(db)
    rows = db.execute(
        "SELECT id, role, content, created_at FROM chat_history "
        "WHERE notebook_id = ? ORDER BY id DESC LIMIT ?",
        (notebook_id, limit),
    ).fetchall()
    db.close()
    return [dict(r) for r in reversed(rows)]
