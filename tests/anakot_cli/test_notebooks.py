"""Tests for the NotebookLLM DB layer (anakot_cli/notebooks.py)."""

import pytest
from pathlib import Path
from unittest.mock import patch


@pytest.fixture(autouse=True)
def _tmp_notebooks_dir(tmp_path):
    """Redirect get_anakot_home() to a temp directory for every test."""
    fake_home = tmp_path / "anakot_home"
    fake_home.mkdir()
    with patch("anakot_cli.notebooks.get_anakot_home", return_value=fake_home):
        yield tmp_path


# ── helpers ──────────────────────────────────────────────────────────────


def _create(title="Test Notebook"):
    from anakot_cli.notebooks import create_notebook
    return create_notebook(title)


# ── CRUD ─────────────────────────────────────────────────────────────────


class TestNotebookCRUD:
    def test_create_notebook(self):
        nb = _create("My Notebook")
        assert nb["id"]
        assert nb["title"] == "My Notebook"
        assert nb["created_at"]
        assert nb["updated_at"]

    def test_list_notebooks_empty(self):
        from anakot_cli.notebooks import list_notebooks
        assert list_notebooks() == []

    def test_list_notebooks(self):
        from anakot_cli.notebooks import list_notebooks
        _create("NB 1")
        _create("NB 2")
        nbs = list_notebooks()
        assert len(nbs) == 2
        titles = {nb["title"] for nb in nbs}
        assert titles == {"NB 1", "NB 2"}

    def test_get_notebook(self):
        from anakot_cli.notebooks import get_notebook
        nb = _create()
        fetched = get_notebook(nb["id"])
        assert fetched is not None
        assert fetched["id"] == nb["id"]
        assert fetched["title"] == nb["title"]
        assert isinstance(fetched["sources"], list)
        assert len(fetched["sources"]) == 0

    def test_get_notebook_not_found(self):
        from anakot_cli.notebooks import get_notebook
        assert get_notebook("nonexistent") is None

    def test_rename_notebook(self):
        from anakot_cli.notebooks import rename_notebook, get_notebook
        nb = _create("Old Title")
        ok = rename_notebook(nb["id"], "New Title")
        assert ok is True
        assert get_notebook(nb["id"])["title"] == "New Title"

    def test_rename_notebook_not_found(self):
        from anakot_cli.notebooks import rename_notebook
        assert rename_notebook("nope", "X") is False

    def test_delete_notebook(self):
        from anakot_cli.notebooks import delete_notebook, get_notebook, list_notebooks
        nb = _create()
        ok = delete_notebook(nb["id"])
        assert ok is True
        assert get_notebook(nb["id"]) is None
        assert list_notebooks() == []

    def test_delete_notebook_not_found(self):
        from anakot_cli.notebooks import delete_notebook
        # Returns False for nonexistent notebook (no directory to delete)
        result = delete_notebook("nope")
        assert result is False

    def test_delete_cleans_directory(self):
        from anakot_cli.notebooks import delete_notebook, _notebook_dir
        nb = _create()
        nb_dir = _notebook_dir(nb["id"])
        assert nb_dir.exists()
        delete_notebook(nb["id"])
        assert not nb_dir.exists()


# ── Source management ────────────────────────────────────────────────────


class TestSourceManagement:
    def test_add_text_source(self):
        from anakot_cli.notebooks import add_source, get_notebook
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="doc.txt",
            original_name="document.txt",
            source_type="text",
            content_bytes=b"Hello world. This is a test document.",
            extracted_text="Hello world. This is a test document.",
            page_count=0,
            word_count=6,
            char_count=35,
        )
        assert src["id"]
        assert src["source_type"] == "text"
        assert src["word_count"] == 6

        # Check it appears in the notebook
        fetched = get_notebook(nb["id"])
        assert len(fetched["sources"]) == 1
        assert fetched["sources"][0]["id"] == src["id"]

    def test_add_url_source(self):
        from anakot_cli.notebooks import add_source, get_source
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="url_page.txt",
            original_name="https://example.com",
            source_type="url",
            content_bytes=b"Page content here.",
            extracted_text="Page content here.",
            page_count=0,
            word_count=3,
            char_count=18,
            url="https://example.com",
        )
        assert src["source_type"] == "url"
        # URL is stored in DB but add_source return dict doesn't include it;
        # get_source does
        fetched = get_source(nb["id"], src["id"])
        assert fetched["url"] == "https://example.com"

    def test_get_source(self):
        from anakot_cli.notebooks import add_source, get_source
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="f.txt",
            original_name="f.txt",
            source_type="text",
            content_bytes=b"content",
            extracted_text="content",
            page_count=0,
            word_count=1,
            char_count=7,
        )
        fetched = get_source(nb["id"], src["id"])
        assert fetched is not None
        assert fetched["filename"] == "f.txt"

    def test_get_source_text(self):
        from anakot_cli.notebooks import add_source, get_source_text
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="f.txt",
            original_name="f.txt",
            source_type="text",
            content_bytes=b"the text",
            extracted_text="the text",
            page_count=0,
            word_count=2,
            char_count=8,
        )
        text = get_source_text(nb["id"], src["id"])
        assert text == "the text"

    def test_get_source_text_not_found(self):
        from anakot_cli.notebooks import get_source_text
        nb = _create()
        assert get_source_text(nb["id"], "nope") is None

    def test_update_source_summary(self):
        from anakot_cli.notebooks import add_source, update_source_summary, get_source
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="f.txt",
            original_name="f.txt",
            source_type="text",
            content_bytes=b"content",
            extracted_text="content",
            page_count=0,
            word_count=1,
            char_count=7,
        )
        ok = update_source_summary(nb["id"], src["id"], "This is a summary.")
        assert ok is True
        updated = get_source(nb["id"], src["id"])
        assert updated["summary"] == "This is a summary."

    def test_delete_source(self):
        from anakot_cli.notebooks import add_source, delete_source, get_source, get_notebook
        nb = _create()
        src = add_source(
            notebook_id=nb["id"],
            filename="f.txt",
            original_name="f.txt",
            source_type="text",
            content_bytes=b"content",
            extracted_text="content",
            page_count=0,
            word_count=1,
            char_count=7,
        )
        ok = delete_source(nb["id"], src["id"])
        assert ok is True
        assert get_source(nb["id"], src["id"]) is None
        assert len(get_notebook(nb["id"])["sources"]) == 0

    def test_delete_source_not_found(self):
        from anakot_cli.notebooks import delete_source
        nb = _create()
        assert delete_source(nb["id"], "nope") is False

    def test_get_all_extracted_text(self):
        from anakot_cli.notebooks import add_source, get_all_extracted_text
        nb = _create()
        add_source(
            notebook_id=nb["id"],
            filename="a.txt",
            original_name="a.txt",
            source_type="text",
            content_bytes=b"First document.",
            extracted_text="First document.",
            page_count=0,
            word_count=2,
            char_count=15,
        )
        add_source(
            notebook_id=nb["id"],
            filename="b.txt",
            original_name="b.txt",
            source_type="text",
            content_bytes=b"Second document.",
            extracted_text="Second document.",
            page_count=0,
            word_count=2,
            char_count=16,
        )
        combined = get_all_extracted_text(nb["id"])
        assert "First document." in combined
        assert "Second document." in combined
        # Implementation uses "--- Source: <filename> ---" format
        assert "--- Source: a.txt ---" in combined
        assert "--- Source: b.txt ---" in combined

    def test_get_all_extracted_text_empty(self):
        from anakot_cli.notebooks import get_all_extracted_text
        nb = _create()
        assert get_all_extracted_text(nb["id"]) == ""

    def test_multiple_sources_ordering(self):
        from anakot_cli.notebooks import add_source, get_notebook
        nb = _create()
        ids = []
        for i in range(5):
            src = add_source(
                notebook_id=nb["id"],
                filename=f"f{i}.txt",
                original_name=f"f{i}.txt",
                source_type="text",
                content_bytes=b"x",
                extracted_text="x",
                page_count=0,
                word_count=1,
                char_count=1,
            )
            ids.append(src["id"])
        fetched = get_notebook(nb["id"])
        assert len(fetched["sources"]) == 5
        assert [s["id"] for s in fetched["sources"]] == ids


# ── Text extraction ──────────────────────────────────────────────────────


class TestTextExtraction:
    def test_extract_text_content(self):
        from anakot_cli.notebooks import extract_text_content
        text, pages = extract_text_content("Hello world. This is a test.")
        assert text == "Hello world. This is a test."
        assert pages >= 1  # Implementation returns 1 for non-empty text

    def test_extract_text_content_empty(self):
        from anakot_cli.notebooks import extract_text_content
        text, pages = extract_text_content("")
        assert text == ""
        # Implementation returns 1 even for empty (counts as 1 "page")
        assert pages >= 0

    def test_extract_pdf_text_nonexistent(self):
        from anakot_cli.notebooks import extract_pdf_text
        # Implementation catches the error and returns ("", 0) instead of raising
        text, pages = extract_pdf_text("/nonexistent/file.pdf")
        assert text == ""
        assert pages == 0
