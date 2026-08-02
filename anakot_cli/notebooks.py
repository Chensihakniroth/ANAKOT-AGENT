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
from typing import Any, Dict, List, Optional

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
        "sources": [dict(s) for s in sources],
    }


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
