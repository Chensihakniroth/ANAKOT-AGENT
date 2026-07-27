// NotebookLLM — Main notebook overlay view
// Three-panel layout: source list (left) | chat (center) | summary (right)

import { useCallback, useEffect, useRef, useState } from "react";
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
  chatNotebook,
  summarizeNotebook,
  loadChatHistory,
  saveChatMessage,
} from "./notebook-store";
import type { Notebook, NotebookSource } from "./notebook-store";
import { MarkdownTextContent } from "@/components/assistant-ui/markdown-text";
import { notify, notifyError } from "@/store/notifications";

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
  const chatStreamAbortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const hasStreamedOnceRef = useRef(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
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

  // If overlay reopens with notebook already selected (from previous session), reload chat
  useEffect(() => {
    if (currentNotebook) {
      loadChatHistory(currentNotebook.id)
        .then((history) => {
          setChatMessages(history);
          if (history.length > 0) hasStreamedOnceRef.current = true;
        })
        .catch(() => {});
    }
  }, []);

  const handleCreateNotebook = useCallback(async () => {
    await createNotebook("Untitled Notebook");
  }, []);

  const handleSelectNotebook = useCallback(async (nb: Notebook) => {
    await loadNotebook(nb.id);
    setSelectedSource(null);
    setSourceText("");
    setOverview("");
    hasStreamedOnceRef.current = false;
    // Load persisted chat history
    try {
      const history = await loadChatHistory(nb.id);
      setChatMessages(history);
      if (history.length > 0) hasStreamedOnceRef.current = true;
    } catch {
      setChatMessages([]);
    }
  }, []);

  const handleDeleteNotebook = useCallback(
    async (id: string) => {
      setConfirmDialog({
        message: "Delete this notebook and all its sources?",
        onConfirm: async () => {
          await deleteNotebook(id);
          notify({ kind: "success", message: "Notebook deleted" });
        },
      });
    },
    []
  );

  const handleRename = useCallback(async () => {
    if (currentNotebook && titleInput.trim()) {
      await renameNotebook(currentNotebook.id, titleInput.trim());
      setEditingTitle(false);
    }
  }, [currentNotebook, titleInput]);

  const [summarizing, setSummarizing] = useState(false);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentNotebook) return;
      await uploadSource(currentNotebook.id, file);
      e.target.value = "";
      // Auto-summarize sources that don't have summaries
      setSummarizing(true);
      summarizeNotebook(currentNotebook.id)
        .then((r) => {
          if (r.summarized > 0) loadNotebook(currentNotebook.id);
        })
        .catch(() => {})
        .finally(() => setSummarizing(false));
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
      setConfirmDialog({
        message: "Remove this source?",
        onConfirm: async () => {
          await deleteSource(currentNotebook.id, sourceId);
          if (selectedSource?.id === sourceId) {
            setSelectedSource(null);
            setSourceText("");
          }
          notify({ kind: "success", message: "Source removed" });
        },
      });
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
      notify({ kind: "success", message: `Re-extracted ${result.re_extracted} source(s)` });
    } catch (err) {
      notifyError(err, "Re-extract failed");
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

  // Auto-refresh overview when notebook loads
  useEffect(() => {
    if (currentNotebook) handleLoadOverview();
  }, [currentNotebook, handleLoadOverview]);

  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !currentNotebook) return;
    const question = chatInput.trim();
    setChatInput("");
    const userMsg = { role: "user" as const, content: question };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    // Persist user message
    saveChatMessage(currentNotebook.id, "user", question).catch(() => {});
    setChatLoading(true);
    hasStreamedOnceRef.current = true;

    // Abort any in-flight stream
    chatStreamAbortRef.current?.abort();
    const controller = new AbortController();
    chatStreamAbortRef.current = controller;

    try {
      const token = (window as unknown as Record<string, unknown>).__ANAKOT_SESSION_TOKEN__ as string | undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["X-Anakot-Session-Token"] = token;

      const res = await fetch(`/api/notebooks/${currentNotebook.id}/chat/stream`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ message: question, history: updatedMessages.slice(0, -1) }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      // Add empty assistant message that we'll update progressively
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                accumulated += parsed.delta;
                const snap = accumulated;
                setChatMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: snap };
                  return next;
                });
              }
            } catch { /* ignore malformed chunks */ }
          }
        }
      }

      // Persist final accumulated response
      if (accumulated) {
        saveChatMessage(currentNotebook.id, "assistant", accumulated).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
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
  }, [chatInput, currentNotebook, chatMessages]);

  // Auto-scroll chat to bottom during streaming
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages]);

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
        <div className="border-b border-(--ui-stroke-secondary) p-3">
          <button
            onClick={() => $currentNotebook.set(null)}
            className="text-sm text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
            type="button"
          >
            ← Back
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

        {/* Summarize all button + status */}
        {sources.length > 0 && (
          <div className="border-b border-(--ui-stroke-secondary) p-3">
            <button
              onClick={async () => {
                if (!currentNotebook) return;
                setSummarizing(true);
                try {
                  const r = await summarizeNotebook(currentNotebook.id);
                  await loadNotebook(currentNotebook.id);
                  notify({
                    kind: r.summarized > 0 ? "success" : "info",
                    message: r.summarized > 0 ? `Summarized ${r.summarized} source(s)` : "All sources already have summaries",
                  });
                } catch (err) {
                  notifyError(err, "Summarize failed");
                } finally {
                  setSummarizing(false);
                }
              }}
              disabled={summarizing}
              className="w-full rounded-md border border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary) disabled:opacity-50"
              type="button"
            >
              {summarizing ? "⏳ Summarizing..." : "✨ Summarize All Sources"}
            </button>
          </div>
        )}

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
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-(--ui-text-tertiary)">
              <div className="mb-3 text-3xl">💬</div>
              <p className="text-sm">
                Ask questions about your {sources.length} source{sources.length !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              msg.role === "user" ? (
                <div
                  key={i}
                  className="ml-12 rounded-lg bg-(--ui-accent)/10 px-4 py-3 text-sm text-(--ui-text-primary)"
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  key={i}
                  data-slot="aui_assistant-message-content"
                  className="mr-12 rounded-lg bg-(--ui-surface-elevated) px-4 py-3 text-sm text-(--ui-text-secondary)"
                >
                  <MarkdownTextContent text={msg.content} isRunning={false} />
                </div>
              )
            ))
          )}
          {chatLoading && !hasStreamedOnceRef.current && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.content === "" && (
            <div className="mr-12 rounded-lg bg-(--ui-surface-elevated) px-4 py-3 text-sm text-(--ui-text-tertiary)">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{animationDelay: "0.2s"}}>●</span>
                <span className="animate-pulse" style={{animationDelay: "0.4s"}}>●</span>
              </span>
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
              placeholder={chatLoading ? "Waiting for response..." : "Ask about your sources... (Shift+Enter for newline)"}
              className="flex-1 rounded-md border border-(--ui-stroke-secondary) bg-transparent px-4 py-2 text-sm text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary)"
              disabled={chatLoading}
            />
            {chatLoading ? (
              <button
                onClick={() => chatStreamAbortRef.current?.abort()}
                className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                type="button"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleChat}
                disabled={!chatInput.trim()}
                className="rounded-md bg-(--ui-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                type="button"
              >
                Send
              </button>
            )}
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
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) px-2 py-0.5 text-[10px] text-(--ui-text-secondary)">
                  {selectedSource.source_type}
                </span>
                <span className="inline-flex items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) px-2 py-0.5 text-[10px] text-(--ui-text-secondary)">
                  {(selectedSource.word_count ?? 0).toLocaleString()} words
                </span>
                <span className="inline-flex items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) px-2 py-0.5 text-[10px] text-(--ui-text-secondary)">
                  {(selectedSource.char_count ?? 0).toLocaleString()} chars
                </span>
                {(selectedSource.page_count ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) px-2 py-0.5 text-[10px] text-(--ui-text-secondary)">
                    {selectedSource.page_count} pages
                  </span>
                )}
              </div>
              {selectedSource.summary && (
                <div className="mb-3 rounded border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-(--ui-accent)">
                    Summary
                  </div>
                  <div data-slot="aui_assistant-message-content">
                    <MarkdownTextContent text={selectedSource.summary} isRunning={false} />
                  </div>
                </div>
              )}
              <div className="rounded border border-(--ui-stroke-secondary) bg-(--ui-surface-background) p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-(--ui-accent)">
                  Extracted Text Preview
                </div>
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-(--ui-text-secondary)">
                  {sourceText || "Loading..."}
                </div>
              </div>
            </div>
          ) : (
            <div data-slot="aui_assistant-message-content">
              {overview ? (
                <MarkdownTextContent text={overview} isRunning={false} />
              ) : (
                <p className="text-center text-(--ui-text-tertiary)">
                  Click "Refresh" to load overview
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom confirm dialog */}
      {confirmDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-surface-background) p-5 shadow-lg">
            <p className="mb-4 text-sm text-(--ui-text-primary)">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-md border border-(--ui-stroke-secondary) px-3 py-1.5 text-xs text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await action();
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
