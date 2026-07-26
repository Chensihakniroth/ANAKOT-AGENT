// NotebookLLM — Main notebook overlay view
// Three-panel layout: source list (left) | chat (center) | summary (right)

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  $notebooks,
  $currentNotebook,
  $notebooksLoading,
  $notebookUploading,
  loadNotebooks,
  createNotebook,
  loadNotebook,
  deleteNotebook,
  renameNotebook,
  uploadSource,
  addUrlSource,
  deleteSource,
  getNotebookContext,
  reExtractSources,
} from "./notebook-store";
import type { Notebook, NotebookSource } from "./notebook-store";

interface NotebookViewProps {
  onClose: () => void;
}

export function NotebookView({ onClose }: NotebookViewProps) {
  const notebooks = useStore($notebooks) ?? [];
  const currentNotebook = useStore($currentNotebook);
  const loading = useStore($notebooksLoading) ?? false;
  const uploading = useStore($notebookUploading) ?? false;

  const [urlInput, setUrlInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [selectedSource, setSelectedSource] = useState<NotebookSource | null>(
    null
  );
  const [sourceText, setSourceText] = useState<string>("");
  const [overview, setOverview] = useState<string>("");

  const sources = currentNotebook?.sources ?? [];

  useEffect(() => {
    loadNotebooks();
  }, []);

  const handleCreateNotebook = useCallback(async () => {
    await createNotebook("Untitled Notebook");
  }, []);

  const handleSelectNotebook = useCallback(async (nb: Notebook) => {
    await loadNotebook(nb.id);
    setChatMessages([]);
    setSelectedSource(null);
    setSourceText("");
    setOverview("");
  }, []);

  const handleDeleteNotebook = useCallback(
    async (id: string) => {
      if (confirm("Delete this notebook and all its sources?")) {
        await deleteNotebook(id);
      }
    },
    []
  );

  const handleRename = useCallback(async () => {
    if (currentNotebook && titleInput.trim()) {
      await renameNotebook(currentNotebook.id, titleInput.trim());
      setEditingTitle(false);
    }
  }, [currentNotebook, titleInput]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentNotebook) return;
      await uploadSource(currentNotebook.id, file);
      e.target.value = "";
    },
    [currentNotebook]
  );

  const handleAddUrl = useCallback(async () => {
    if (!urlInput.trim() || !currentNotebook) return;
    await addUrlSource(currentNotebook.id, urlInput.trim());
    setUrlInput("");
  }, [urlInput, currentNotebook]);

  const handleDeleteSource = useCallback(
    async (sourceId: string) => {
      if (!currentNotebook) return;
      if (confirm("Remove this source?")) {
        await deleteSource(currentNotebook.id, sourceId);
        if (selectedSource?.id === sourceId) {
          setSelectedSource(null);
          setSourceText("");
        }
      }
    },
    [currentNotebook, selectedSource]
  );

  const [reExtracting, setReExtracting] = useState(false);
  const handleReExtract = useCallback(async () => {
    if (!currentNotebook) return;
    setReExtracting(true);
    try {
      const result = await reExtractSources(currentNotebook.id);
      // Reload notebook to pick up updated word counts
      await loadNotebook(currentNotebook.id);
      alert(`Re-extracted ${result.re_extracted} source(s)`);
    } catch (err) {
      alert(`Re-extract failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setReExtracting(false);
    }
  }, [currentNotebook]);

  const handleSelectSource = useCallback(
    async (src: NotebookSource) => {
      setSelectedSource(src);
      if (!currentNotebook) return;
      try {
        const ctx = await getNotebookContext(currentNotebook.id);
        setSourceText(ctx.text.slice(0, 5000));
      } catch {
        setSourceText("(unable to load source text)");
      }
    },
    [currentNotebook]
  );

  const handleLoadOverview = useCallback(async () => {
    if (!currentNotebook) return;
    try {
      const ctx = await getNotebookContext(currentNotebook.id);
      setOverview(
        ctx.char_count > 0
          ? `Combined context: ${ctx.char_count.toLocaleString()} characters from ${sources.length} source(s).`
          : "No sources yet."
      );
    } catch {
      setOverview("(unable to load overview)");
    }
  }, [currentNotebook, sources.length]);

  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !currentNotebook) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);
    try {
      const ctx = await getNotebookContext(currentNotebook.id);

      const response =
        ctx.char_count > 0
          ? `[Notebook chat — ${ctx.char_count.toLocaleString()} chars of context loaded]\n\nBased on ${sources.length} source(s), here's what I can tell you about "${question}":\n\n(Deep AI analysis will be connected via gateway WebSocket in the next iteration.)`
          : "No sources loaded yet. Please upload some documents first.";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, currentNotebook, sources.length]);

  // ── Notebook list view (no notebook selected) ──────────────────────────
  if (!currentNotebook) {
    return (
      <div className="flex h-full flex-col bg-(--ui-surface-background) p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-(--ui-text-primary)">
            📓 Notebooks
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handleCreateNotebook}
              className="rounded-md bg-(--ui-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              type="button"
            >
              + New Notebook
            </button>
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-(--ui-text-tertiary)">
            Loading notebooks...
          </div>
        ) : notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-(--ui-text-tertiary)">
            <div className="mb-4 text-4xl">📓</div>
            <p className="mb-4 text-lg">No notebooks yet</p>
            <button
              onClick={handleCreateNotebook}
              className="rounded-md bg-(--ui-accent) px-6 py-3 text-sm font-medium text-white hover:opacity-90"
              type="button"
            >
              Create your first notebook
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                className="group cursor-pointer rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) p-4 transition-colors hover:border-(--ui-accent)"
                onClick={() => handleSelectNotebook(nb)}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-(--ui-text-primary)">
                    {nb.title}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotebook(nb.id);
                    }}
                    className="text-xs text-(--ui-text-tertiary) opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-(--ui-text-tertiary)">
                  {(nb.sources ?? []).length} source{(nb.sources ?? []).length !== 1 ? "s" : ""}
                </p>
                <p className="mt-1 text-xs text-(--ui-text-tertiary)">
                  {new Date(nb.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Notebook detail view (three-panel) ─────────────────────────────────
  return (
    <div className="flex h-full bg-(--ui-surface-background)">
      {/* Left panel: Source list */}
      <div className="flex w-64 flex-col border-r border-(--ui-stroke-secondary)">
        <div className="flex items-center justify-between border-b border-(--ui-stroke-secondary) p-3">
          <button
            onClick={() => $currentNotebook.set(null)}
            className="text-sm text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
            type="button"
          >
            ← Back
          </button>
          <button
            onClick={onClose}
            className="text-sm text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Notebook title */}
        <div className="border-b border-(--ui-stroke-secondary) p-3">
          {editingTitle ? (
            <div className="flex gap-1">
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                className="flex-1 rounded border border-(--ui-stroke-secondary) bg-transparent px-2 py-1 text-sm text-(--ui-text-primary)"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="text-xs text-(--ui-accent)"
                type="button"
              >
                ✓
              </button>
            </div>
          ) : (
            <h2
              className="cursor-pointer truncate text-sm font-medium text-(--ui-text-primary) hover:text-(--ui-accent)"
              onClick={() => {
                setTitleInput(currentNotebook.title);
                setEditingTitle(true);
              }}
            >
              {currentNotebook.title}
            </h2>
          )}
        </div>

        {/* Upload controls */}
        <div className="border-b border-(--ui-stroke-secondary) p-3 space-y-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)">
            📎 {uploading ? "Uploading..." : "Upload File"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.csv,.json,.py,.js,.ts,.html,.css"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <div className="flex gap-1">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              placeholder="Add URL..."
              className="flex-1 rounded border border-(--ui-stroke-secondary) bg-transparent px-2 py-1 text-xs text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary)"
            />
            <button
              onClick={handleAddUrl}
              disabled={!urlInput.trim()}
              className="rounded bg-(--ui-accent) px-2 py-1 text-xs text-white disabled:opacity-50"
              type="button"
            >
              +
            </button>
          </div>
        </div>

        {/* Re-extract button (shows when sources have 0 words — failed extraction) */}
        {sources.length > 0 && sources.some((s) => (s.word_count ?? 0) === 0) && (
          <div className="border-b border-(--ui-stroke-secondary) p-3">
            <button
              onClick={handleReExtract}
              disabled={reExtracting}
              className="w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
              type="button"
            >
              {reExtracting ? "⏳ Re-extracting..." : "⚠️ Re-extract text (sources have 0 words)"}
            </button>
          </div>
        )}

        {/* Source list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sources.length === 0 ? (
            <p className="p-2 text-center text-xs text-(--ui-text-tertiary)">
              No sources yet
            </p>
          ) : (
            sources.map((src) => (
              <div
                key={src.id}
                className={`group flex items-center justify-between rounded p-2 text-xs cursor-pointer transition-colors ${
                  selectedSource?.id === src.id
                    ? "bg-(--ui-accent)/10 text-(--ui-accent)"
                    : "text-(--ui-text-secondary) hover:bg-(--ui-surface-elevated)"
                }`}
                onClick={() => handleSelectSource(src)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {src.source_type === "pdf" ? "📄" : src.source_type === "url" ? "🔗" : "📝"}{" "}
                    {src.original_name}
                  </div>
                  <div className="text-[10px] text-(--ui-text-tertiary)">
                    {(src.word_count ?? 0).toLocaleString()} words
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSource(src.id);
                  }}
                  className="ml-1 text-[10px] text-(--ui-text-tertiary) opacity-0 hover:text-red-500 group-hover:opacity-100"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center panel: Chat */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-(--ui-text-tertiary)">
              <div className="mb-3 text-3xl">💬</div>
              <p className="text-sm">
                Ask questions about your {sources.length} source(s)
              </p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "ml-12 bg-(--ui-accent)/10 text-(--ui-text-primary)"
                    : "mr-12 bg-(--ui-surface-elevated) text-(--ui-text-secondary)"
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
          {chatLoading && (
            <div className="mr-12 rounded-lg bg-(--ui-surface-elevated) px-4 py-3 text-sm text-(--ui-text-tertiary)">
              Thinking...
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="border-t border-(--ui-stroke-secondary) p-3">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
              placeholder="Ask about your sources..."
              className="flex-1 rounded-md border border-(--ui-stroke-secondary) bg-transparent px-4 py-2 text-sm text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary)"
              disabled={chatLoading}
            />
            <button
              onClick={handleChat}
              disabled={!chatInput.trim() || chatLoading}
              className="rounded-md bg-(--ui-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              type="button"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Source preview / Overview */}
      <div className="flex w-72 flex-col border-l border-(--ui-stroke-secondary)">
        <div className="flex items-center justify-between border-b border-(--ui-stroke-secondary) p-3">
          <span className="text-xs font-medium text-(--ui-text-secondary)">
            {selectedSource ? "Source Preview" : "Overview"}
          </span>
          {!selectedSource && (
            <button
              onClick={handleLoadOverview}
              className="text-xs text-(--ui-accent) hover:underline"
              type="button"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 text-xs text-(--ui-text-secondary) whitespace-pre-wrap">
          {selectedSource ? (
            <div>
              <h4 className="mb-2 font-medium text-(--ui-text-primary)">
                {selectedSource.original_name}
              </h4>
              <div className="mb-2 space-y-1 text-[10px] text-(--ui-text-tertiary)">
                <div>Type: {selectedSource.source_type}</div>
                <div>Words: {(selectedSource.word_count ?? 0).toLocaleString()}</div>
                <div>Chars: {(selectedSource.char_count ?? 0).toLocaleString()}</div>
                {(selectedSource.page_count ?? 0) > 0 && (
                  <div>Pages: {selectedSource.page_count}</div>
                )}
              </div>
              {selectedSource.summary && (
                <div className="mb-3 rounded bg-(--ui-surface-elevated) p-2">
                  <div className="mb-1 font-medium text-(--ui-text-primary)">
                    Summary
                  </div>
                  {selectedSource.summary}
                </div>
              )}
              <div className="text-[10px] text-(--ui-text-tertiary)">
                {sourceText || "Loading..."}
              </div>
            </div>
          ) : (
            <div>
              {overview || (
                <p className="text-center text-(--ui-text-tertiary)">
                  Click "Refresh" to load overview
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
