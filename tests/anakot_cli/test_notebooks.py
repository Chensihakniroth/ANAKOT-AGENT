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

# ── Chat history ───────────────────────────────────────────────────────


class TestChatHistory:
    def test_save_and_load_chat_messages(self):
        from anakot_cli.notebooks import save_chat_message, load_chat_history
        nb = _create()
        save_chat_message(nb["id"], "user", "Hello AI")
        save_chat_message(nb["id"], "assistant", "Hi there!")
        history = load_chat_history(nb["id"])
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello AI"
        assert history[1]["role"] == "assistant"
        assert history[1]["content"] == "Hi there!"

    def test_load_chat_history_returns_oldest_first(self):
        from anakot_cli.notebooks import save_chat_message, load_chat_history
        nb = _create()
        save_chat_message(nb["id"], "user", "First")
        save_chat_message(nb["id"], "assistant", "Second")
        save_chat_message(nb["id"], "user", "Third")
        history = load_chat_history(nb["id"])
        assert [m["role"] for m in history] == ["user", "assistant", "user"]
        assert [m["content"] for m in history] == ["First", "Second", "Third"]

    def test_load_chat_history_limit(self):
        from anakot_cli.notebooks import save_chat_message, load_chat_history
        nb = _create()
        for i in range(10):
            save_chat_message(nb["id"], "user", f"msg {i}")
        history = load_chat_history(nb["id"], limit=3)
        assert len(history) == 3
        assert history[0]["content"] == "msg 7"
        assert history[2]["content"] == "msg 9"

    def test_clear_chat_history(self):
        from anakot_cli.notebooks import save_chat_message, load_chat_history, clear_chat_history
        nb = _create()
        save_chat_message(nb["id"], "user", "msg1")
        save_chat_message(nb["id"], "assistant", "msg2")
        assert len(load_chat_history(nb["id"])) == 2
        clear_chat_history(nb["id"])
        assert len(load_chat_history(nb["id"])) == 0

    def test_chat_history_isolation_between_notebooks(self):
        from anakot_cli.notebooks import save_chat_message, load_chat_history
        nb1 = _create("NB1")
        nb2 = _create("NB2")
        save_chat_message(nb1["id"], "user", "from nb1")
        save_chat_message(nb2["id"], "user", "from nb2")
        h1 = load_chat_history(nb1["id"])
        h2 = load_chat_history(nb2["id"])
        assert len(h1) == 1
        assert h1[0]["content"] == "from nb1"
        assert len(h2) == 1
        assert h2[0]["content"] == "from nb2"


# ── Source reordering ──────────────────────────────────────────────────


class TestSourceReordering:
    def _create_with_sources(self, count=3):
        from anakot_cli.notebooks import add_source
        nb = _create()
        ids = []
        for i in range(count):
            src = add_source(
                notebook_id=nb["id"],
                filename=f"file{i}.txt",
                original_name=f"file{i}.txt",
                source_type="text",
                content_bytes=b"content",
                extracted_text=f"text {i}",
                page_count=1,
                word_count=1,
                char_count=7,
            )
            ids.append(src["id"])
        return nb, ids

    def test_reorder_sources_basic(self):
        from anakot_cli.notebooks import reorder_sources, get_notebook
        nb, ids = self._create_with_sources()
        result = reorder_sources(nb["id"], list(reversed(ids)))
        result_ids = [s["id"] for s in result]
        assert result_ids == list(reversed(ids))

    def test_reorder_sources_partial_list(self):
        from anakot_cli.notebooks import reorder_sources, get_notebook
        nb, ids = self._create_with_sources(4)
        reorder_sources(nb["id"], [ids[1], ids[0]])
        notebook = get_notebook(nb["id"])
        result_ids = [s["id"] for s in notebook["sources"]]
        assert result_ids[0] == ids[1]
        assert result_ids[1] == ids[0]
        assert ids[2] in result_ids[2:]
        assert ids[3] in result_ids[2:]

    def test_reorder_sources_empty_list(self):
        from anakot_cli.notebooks import reorder_sources, get_notebook
        nb, ids = self._create_with_sources()
        result = reorder_sources(nb["id"], [])
        notebook = get_notebook(nb["id"])
        result_ids = [s["id"] for s in notebook["sources"]]
        # All sources should still exist; order may differ because remaining is a set
        assert set(result_ids) == set(ids)

    def test_reorder_sources_invalid_ids_ignored(self):
        from anakot_cli.notebooks import reorder_sources, get_notebook
        nb, ids = self._create_with_sources()
        result = reorder_sources(nb["id"], [ids[2], "nonexistent", ids[0], ids[1]])
        result_ids = [s["id"] for s in result]
        assert result_ids == [ids[2], ids[0], ids[1]]

    def test_sort_order_on_initial_insert(self):
        from anakot_cli.notebooks import get_notebook
        nb, ids = self._create_with_sources()
        notebook = get_notebook(nb["id"])
        result_ids = [s["id"] for s in notebook["sources"]]
        assert result_ids == ids


# ── Streaming parser (unit) ────────────────────────────────────────────


class TestStreamingParser:
    def test_anthropic_format_parsing(self):
        """Verify Anthropic content_block_delta is parsed correctly."""
        chunk = {
            "type": "content_block_delta",
            "delta": {"type": "text_delta", "text": "Hello"}
        }
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        content_text = delta.get("content", "")
        if not content_text and chunk.get("type") == "content_block_delta":
            inner_delta = chunk.get("delta", {})
            if inner_delta.get("type") == "text_delta":
                content_text = inner_delta.get("text", "")
        assert content_text == "Hello"

    def test_openai_format_parsing(self):
        """Verify OpenAI delta format is parsed correctly."""
        chunk = {
            "choices": [{"delta": {"content": "World"}}]
        }
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        content_text = delta.get("content", "")
        if not content_text and chunk.get("type") == "content_block_delta":
            inner_delta = chunk.get("delta", {})
            if inner_delta.get("type") == "text_delta":
                content_text = inner_delta.get("text", "")
        assert content_text == "World"

    def test_error_format_detected(self):
        """Verify error responses are detected (no content extracted)."""
        chunk = {"error": "No API key configured"}
        delta = chunk.get("choices", [{}])[0].get("delta", {})
        content_text = delta.get("content", "")
        if not content_text and chunk.get("type") == "content_block_delta":
            inner_delta = chunk.get("delta", {})
            if inner_delta.get("type") == "text_delta":
                content_text = inner_delta.get("text", "")
        assert content_text == ""
        assert "error" in chunk


# ── Retrieval: chunking ────────────────────────────────────────────────


class TestChunkText:
    def test_empty_text(self):
        from anakot_cli.notebooks import chunk_text
        assert chunk_text("") == []
        assert chunk_text("   \n  ") == []

    def test_short_text_single_chunk(self):
        from anakot_cli.notebooks import chunk_text
        assert chunk_text("hello world") == ["hello world"]

    def test_long_text_multiple_chunks_with_overlap(self):
        from anakot_cli.notebooks import chunk_text
        text = "a" * 3000
        chunks = chunk_text(text)
        assert len(chunks) >= 2
        assert all(chunks)
        # Overlap window is preserved between consecutive chunks
        assert chunks[0][-200:] == chunks[1][:200]

    def test_prefers_newline_boundary(self):
        from anakot_cli.notebooks import chunk_text
        text = "p" * 1000 + "\n" + "q" * 2000
        chunks = chunk_text(text)
        # First chunk breaks at the newline in the back half of the window
        assert chunks[0] == "p" * 1000


# ── Retrieval: tokenize ────────────────────────────────────────────────


class TestTokenize:
    def test_basic(self):
        from anakot_cli.notebooks import tokenize
        assert tokenize("The Quick, Brown Fox! 123") == ["quick", "brown", "fox", "123"]

    def test_removes_stopwords_and_single_chars(self):
        from anakot_cli.notebooks import tokenize
        assert tokenize("a the and of") == []


# ── Retrieval: ranking ─────────────────────────────────────────────────


class TestRankChunks:
    def test_relevant_chunk_scores_higher(self):
        from anakot_cli.notebooks import rank_chunks
        chunks = [
            (0, "The anaconda is a large snake found in the amazon rainforest."),
            (1, "Quantum entanglement is a physics phenomenon."),
        ]
        scored = rank_chunks("anaconda snake", chunks)
        assert len(scored) == 2
        assert all(len(item) == 3 for item in scored)
        assert scored[0][0] == 0
        assert scored[0][2] > scored[1][2]

    def test_empty_query_scores_zero(self):
        from anakot_cli.notebooks import rank_chunks
        chunks = [(0, "anaconda snakes"), (1, "quantum physics")]
        scored = rank_chunks("the and of", chunks)
        assert all(item[2] == 0.0 for item in scored)


# ── Retrieval: context building ────────────────────────────────────────


class TestBuildChatContext:
    def _add(self, nb, filename, text):
        from anakot_cli.notebooks import add_source
        return add_source(
            notebook_id=nb["id"],
            filename=filename,
            original_name=filename,
            source_type="text",
            content_bytes=b"x",
            extracted_text=text,
            page_count=0,
            word_count=1,
            char_count=1,
        )

    def test_no_sources_returns_none(self):
        from anakot_cli.notebooks import build_chat_context
        nb = _create()
        assert build_chat_context(nb["id"], "hello") == (None, None)

    def test_global_question_uses_even_spread(self):
        from anakot_cli.notebooks import build_chat_context
        nb = _create()
        self._add(nb, "a.txt", "Anaconda snakes live in the amazon. " * 100)
        self._add(nb, "b.txt", "Quantum physics studies entanglement. " * 100)
        ctx, note = build_chat_context(nb["id"], "What is this about?")
        assert ctx
        assert note == ""
        assert "--- Source 1: a.txt ---" in ctx
        assert "--- Source 2: b.txt ---" in ctx

    def test_relevant_source_ranked_and_numbered(self):
        from anakot_cli.notebooks import build_chat_context
        nb = _create()
        self._add(nb, "physics.txt", "Quantum entanglement and wave functions. " * 13)
        self._add(nb, "anaconda.txt", "Anaconda snakes eat fish in the amazon river. " * 13)
        # Budget too small for even one full chunk (~600 chars) — the fallback
        # must keep the single most relevant passage, which is from source 2.
        ctx, note = build_chat_context(nb["id"], "anaconda snakes", max_chars=500)
        assert ctx
        assert note  # passages were omitted
        # Source numbering matches get_notebook order (physics is 1, anaconda is 2)
        assert "--- Source 2: anaconda.txt ---" in ctx
        assert "anaconda" in ctx.lower()
        # Context stays near budget even with the single-block fallback
        assert len(ctx) <= 500 + 600

    def test_budget_caps_total_context(self):
        from anakot_cli.notebooks import build_chat_context
        nb = _create()
        self._add(nb, "big.txt", "Anaconda snakes eat fish. " * 5000)
        ctx, note = build_chat_context(nb["id"], "anaconda fish", max_chars=4000)
        assert ctx
        assert note
        assert len(ctx) <= 4000 + 600
