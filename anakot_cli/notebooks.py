"""
NotebookLLM — Document notebook storage and management.

Stores notebooks in ~/.anakot/notebooks/<notebook_id>/ with:
  - sources/        uploaded files
  - metadata.db     SQLite DB for notebook + source metadata
  - extracted/      extracted text from documents
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

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


def _notebooks_root() -> Path:
    """Return the root directory for all notebooks."""
    root = get_anakot_home() / "notebooks"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _notebook_dir(notebook_id: str) -> Path:
    """Return the directory for a specific notebook."""
    d = _notebooks_root() / notebook_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "sources").mkdir(exist_ok=True)
    (d / "extracted").mkdir(exist_ok=True)
    return d


def _db_path(notebook_id: str) -> Path:
    return _notebook_dir(notebook_id) / "metadata.db"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _get_db(notebook_id: str) -> sqlite3.Connection:
    db = sqlite3.connect(str(_db_path(notebook_id)))
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


# ---------------------------------------------------------------------------
# Notebook CRUD
# ---------------------------------------------------------------------------


def create_notebook(title: str = "Untitled Notebook") -> Dict[str, Any]:
    notebook_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    db = _get_db(notebook_id)
    _init_db(db)
    db.execute(
        "INSERT INTO notebook (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (notebook_id, title, now, now),
    )
    db.commit()
    db.close()
    return {"id": notebook_id, "title": title, "created_at": now, "updated_at": now}


def list_notebooks() -> List[Dict[str, Any]]:
    notebooks: List[Dict[str, Any]] = []
    root = _notebooks_root()
    for d in root.iterdir():
        if d.is_dir() and (d / "metadata.db").exists():
            db = _get_db(d.name)
            _init_db(db)
            row = db.execute(
                "SELECT * FROM notebook WHERE id = ?", (d.name,)
            ).fetchone()
            if row:
                source_count = db.execute(
                    "SELECT COUNT(*) as cnt FROM source WHERE notebook_id = ?",
                    (d.name,),
                ).fetchone()["cnt"]
                notebooks.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "source_count": source_count,
                    }
                )
            db.close()
    notebooks.sort(key=lambda n: n["updated_at"], reverse=True)
    return notebooks


def get_notebook(notebook_id: str) -> Optional[Dict[str, Any]]:
    db = _get_db(notebook_id)
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
        "FROM source WHERE notebook_id = ? ORDER BY created_at",
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


def delete_notebook(notebook_id: str) -> bool:
    nb_dir = _notebooks_root() / notebook_id
    if not nb_dir.exists():
        return False
    import shutil

    shutil.rmtree(nb_dir, ignore_errors=True)
    return True


def rename_notebook(notebook_id: str, title: str) -> bool:
    db = _get_db(notebook_id)
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
) -> Dict[str, Any]:
    source_id = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc).isoformat()

    # Save file to disk
    nb_dir = _notebook_dir(notebook_id)
    file_path = nb_dir / "sources" / filename
    file_path.write_bytes(content_bytes)

    # Save extracted text
    if extracted_text:
        ext_path = nb_dir / "extracted" / f"{source_id}.txt"
        ext_path.write_text(extracted_text, encoding="utf-8")

    db = _get_db(notebook_id)
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
    # Update notebook's updated_at
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


def get_source(notebook_id: str, source_id: str) -> Optional[Dict[str, Any]]:
    db = _get_db(notebook_id)
    _init_db(db)
    row = db.execute(
        "SELECT * FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    db.close()
    if not row:
        return None
    return dict(row)


def get_source_text(notebook_id: str, source_id: str) -> Optional[str]:
    db = _get_db(notebook_id)
    _init_db(db)
    row = db.execute(
        "SELECT extracted_text FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    db.close()
    return row["extracted_text"] if row else None


def update_source_summary(
    notebook_id: str, source_id: str, summary: str
) -> bool:
    db = _get_db(notebook_id)
    _init_db(db)
    cur = db.execute(
        "UPDATE source SET summary = ? WHERE id = ? AND notebook_id = ?",
        (summary, source_id, notebook_id),
    )
    db.commit()
    changed = cur.rowcount > 0
    db.close()
    return changed


def delete_source(notebook_id: str, source_id: str) -> bool:
    db = _get_db(notebook_id)
    _init_db(db)
    row = db.execute(
        "SELECT file_path FROM source WHERE id = ? AND notebook_id = ?",
        (source_id, notebook_id),
    ).fetchone()
    if not row:
        db.close()
        return False

    # Remove file from disk
    fp = Path(row["file_path"])
    if fp.exists():
        fp.unlink()

    # Remove extracted text
    ext_path = _notebook_dir(notebook_id) / "extracted" / f"{source_id}.txt"
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


def get_all_extracted_text(
    notebook_id: str, max_chars: int = 100_000
) -> str:
    """Get combined extracted text from all sources, truncated to max_chars."""
    db = _get_db(notebook_id)
    _init_db(db)
    rows = db.execute(
        "SELECT filename, extracted_text, source_type FROM source "
        "WHERE notebook_id = ? AND extracted_text IS NOT NULL "
        "ORDER BY created_at",
        (notebook_id,),
    ).fetchall()
    db.close()

    parts: list[str] = []
    total = 0
    for row in rows:
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


def save_chat_message(notebook_id: str, role: str, content: str) -> None:
    """Save a chat message to the notebook's history."""
    db = _get_db(notebook_id)
    _init_db(db)
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO chat_history (notebook_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (notebook_id, role, content, now),
    )
    db.commit()
    db.close()


def load_chat_history(notebook_id: str, limit: int = 100) -> list:
    """Load chat history for a notebook, oldest first."""
    db = _get_db(notebook_id)
    _init_db(db)
    rows = db.execute(
        "SELECT role, content, created_at FROM chat_history WHERE notebook_id = ? ORDER BY id DESC LIMIT ?",
        (notebook_id, limit),
    ).fetchall()
    db.close()
    messages = [{"role": r["role"], "content": r["content"], "created_at": r["created_at"]} for r in rows]
    messages.reverse()  # oldest first
    return messages


def clear_chat_history(notebook_id: str) -> None:
    """Clear all chat history for a notebook."""
    db = _get_db(notebook_id)
    _init_db(db)
    db.execute("DELETE FROM chat_history WHERE notebook_id = ?", (notebook_id,))
    db.commit()
    db.close()


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
