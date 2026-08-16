// NotebookLLM — TypeScript types and nanostore atoms (desktop port)
//
// Transport notes (desktop): the renderer cannot fetch the backend directly
// (no CORS on the local server, and auth lives in the main process), so every
// JSON call goes through window.anakotDesktop.api() which proxies to the
// backend with the session token attached. Multipart upload and SSE streaming
// have no JSON IPC equivalent, so they use dedicated main-process channels.

import { atom } from "nanostores";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotebookSource {
  id: string;
  notebook_id: string;
  filename: string;
  original_name: string;
  source_type: "pdf" | "text" | "url";
  url?: string;
  page_count: number;
  word_count: number;
  char_count: number;
  summary?: string;
  created_at: string;
}

export interface Notebook {
  id: string;
  title: string;
  source_count: number;
  source_names?: string[];
  sources: NotebookSource[];
  created_at: string;
  updated_at: string;
  pinned?: boolean;
}

export interface NotebookOverview {
  notebook_id: string;
  title: string;
  source_count: number;
  summaries: string[];
  combined: string;
}

export interface NotebookContext {
  text: string;
  char_count: number;
}

// ── Atoms ──────────────────────────────────────────────────────────────────

/** All notebooks list */
export const $notebooks = atom<Notebook[]>([]);

/** Currently selected notebook (null = none selected) */
export const $currentNotebook = atom<Notebook | null>(null);

/** Loading states */
export const $notebooksLoading = atom<boolean>(false);
export const $notebookUploading = atom<boolean>(false);


// ── Actions ────────────────────────────────────────────────────────────────

const API = "/api";

/**
 * Desktop transport for JSON notebook endpoints. The Electron main process
 * attaches the session token and parses the JSON response, so the renderer
 * only supplies method/path/body. Body must be a JSON-serializable object
 * (not a pre-stringified string) — the main process stringifies it.
 */
async function fetchJSON<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T> {
  const res = await window.anakotDesktop.api<T>({
    method: opts?.method || "GET",
    path,
    body: opts?.body,
  });
  return res as T;
}

/** Load all notebooks */
export async function loadNotebooks(): Promise<void> {
  $notebooksLoading.set(true);
  try {
    const data = await fetchJSON<{ notebooks: Notebook[] }>(
      `${API}/notebooks`
    );
    $notebooks.set(data.notebooks);
  } finally {
    $notebooksLoading.set(false);
  }
}

/** Create a new notebook */
export async function createNotebook(
  title: string = "Untitled Notebook"
): Promise<Notebook> {
  const nb = await fetchJSON<Notebook>(`${API}/notebooks`, {
    method: "POST",
    body: { title },
  });
  $notebooks.set([...$notebooks.get(), nb]);
  $currentNotebook.set(nb);
  return nb;
}

/** Load a single notebook by ID */
export async function loadNotebook(id: string): Promise<Notebook> {
  const nb = await fetchJSON<Notebook>(`${API}/notebooks/${id}`);
  $currentNotebook.set(nb);
  return nb;
}

/** Rename a notebook */
export async function renameNotebook(
  id: string,
  title: string
): Promise<void> {
  await fetchJSON(`${API}/notebooks/${id}`, {
    method: "PUT",
    body: { title },
  });
  // Update local state
  $notebooks.set(
    $notebooks.get().map((n) => (n.id === id ? { ...n, title } : n))
  );
  const cur = $currentNotebook.get();
  if (cur?.id === id) {
    $currentNotebook.set({ ...cur, title });
  }
}

/** Duplicate a notebook with all its sources */
export async function duplicateNotebook(
  notebookId: string,
  title?: string
): Promise<Notebook> {
  const data = await fetchJSON<Notebook>(`${API}/notebooks/${notebookId}/duplicate`, {
    method: "POST",
    body: { title },
  });
  // Reload the full list to get correct source_counts
  await loadNotebooks();
  return data;
}

/** Pin or unpin a notebook (pinned notebooks float to the top of the list) */
export async function setNotebookPinned(
  notebookId: string,
  pinned: boolean
): Promise<void> {
  await fetchJSON<{ ok: boolean }>(`${API}/notebooks/${notebookId}/pin`, {
    method: "POST",
    body: { pinned },
  });
  // Update local state
  $notebooks.set(
    $notebooks.get().map((n) => (n.id === notebookId ? { ...n, pinned } : n))
  );
  const cur = $currentNotebook.get();
  if (cur?.id === notebookId) {
    $currentNotebook.set({ ...cur, pinned });
  }
}

/** Rename a source */
export async function renameSource(
  notebookId: string,
  sourceId: string,
  name: string
): Promise<void> {
  const data = await fetchJSON<{ source: NotebookSource }>(
    `${API}/notebooks/${notebookId}/sources/${sourceId}`,
    {
      method: "PATCH",
      body: { name },
    }
  );
  // Update local state
  const cur = $currentNotebook.get();
  if (cur?.id === notebookId) {
    $currentNotebook.set({
      ...cur,
      sources: cur.sources.map((s) =>
        s.id === sourceId ? { ...s, original_name: name } : s
      ),
    });
  }
}

/** Delete a notebook */
export async function deleteNotebook(id: string): Promise<void> {
  await fetchJSON(`${API}/notebooks/${id}`, { method: "DELETE" });
  $notebooks.set($notebooks.get().filter((n) => n.id !== id));
  const cur = $currentNotebook.get();
  if (cur?.id === id) {
    $currentNotebook.set(null);
  }
}

/**
 * Upload a file as a source. The renderer hands the picked File to the main
 * process (native path via webUtils), which streams it to the backend as
 * multipart/form-data.
 */
export async function uploadSource(
  notebookId: string,
  file: File
): Promise<NotebookSource> {
  $notebookUploading.set(true);
  try {
    const filePath = window.anakotDesktop.getPathForFile(file);
    if (!filePath) {
      throw new Error("Cannot resolve native path for the selected file.");
    }
    const src = (await window.anakotDesktop.notebookUploadSource({
      notebookId,
      filePath,
      fileName: file.name,
    })) as NotebookSource;
    // Refresh notebook to get updated source list
    await loadNotebook(notebookId);
    return src;
  } finally {
    $notebookUploading.set(false);
  }
}

/** Add a URL as a source */
export async function addUrlSource(
  notebookId: string,
  url: string
): Promise<NotebookSource> {
  const src = await fetchJSON<NotebookSource>(
    `${API}/notebooks/${notebookId}/sources/url`,
    {
      method: "POST",
      body: { url },
    }
  );
  await loadNotebook(notebookId);
  return src;
}

/** Delete a source */
export async function deleteSource(
  notebookId: string,
  sourceId: string
): Promise<void> {
  await fetchJSON(`${API}/notebooks/${notebookId}/sources/${sourceId}`, {
    method: "DELETE",
  });
  await loadNotebook(notebookId);
}

/** Get source text content */
export async function getSourceText(
  notebookId: string,
  sourceId: string
): Promise<string> {
  const data = await fetchJSON<{ text: string }>(
    `${API}/notebooks/${notebookId}/sources/${sourceId}/text`
  );
  return data.text;
}

/** Get combined context from all sources */
export async function getNotebookContext(
  notebookId: string
): Promise<NotebookContext> {
  return fetchJSON<NotebookContext>(
    `${API}/notebooks/${notebookId}/context`
  );
}

/** Re-extract text from sources that have empty extracted text (fixes failed PDF extractions) */
export async function reExtractSources(
  notebookId: string
): Promise<{ re_extracted: number }> {
  return fetchJSON<{ re_extracted: number }>(
    `${API}/notebooks/${notebookId}/re-extract`,
    { method: "POST" }
  );
}

/** Get notebook overview with all source summaries */
export async function getNotebookOverview(
  notebookId: string
): Promise<NotebookOverview> {
  return fetchJSON<NotebookOverview>(
    `${API}/notebooks/${notebookId}/overview`
  );
}

/** Generate AI summaries for sources without one */
export async function summarizeNotebook(
  notebookId: string,
  sourceId?: string
): Promise<{ summarized: number; message?: string }> {
  return fetchJSON<{ summarized: number; message?: string }>(
    `${API}/notebooks/${notebookId}/summarize`,
    {
      method: "POST",
      body: { source_id: sourceId ?? null },
    }
  );
}

/** Load chat history for a notebook */
export async function loadChatHistory(
  notebookId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const result = await fetchJSON<{ messages: Array<{ role: string; content: string }> }>(
    `${API}/notebooks/${notebookId}/chat-history`
  );
  return result.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

/** Save a single chat message to history */
export async function saveChatMessage(
  notebookId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await fetchJSON<{ ok: boolean }>(
    `${API}/notebooks/${notebookId}/chat-history`,
    {
      method: "POST",
      body: { role, content },
    }
  );
}

/** Clear all chat history for a notebook */
export async function clearChatHistory(
  notebookId: string
): Promise<void> {
  await fetchJSON<{ ok: boolean }>(
    `${API}/notebooks/${notebookId}/chat-history/clear`,
    { method: "POST" }
  );
}

/**
 * Trim a notebook's persisted chat history to the *keep* oldest messages.
 * Used when the user edits/re-sends or regenerates a message so the SQLite
 * history matches the trimmed UI thread (otherwise deleted messages
 * resurrect on the next notebook open).
 */
export async function truncateChatHistory(
  notebookId: string,
  keep: number
): Promise<number> {
  const res = await fetchJSON<{ ok: boolean; deleted: number }>(
    `${API}/notebooks/${notebookId}/chat-history/truncate`,
    {
      method: "POST",
      body: { keep },
    }
  );
  return res.deleted ?? 0;
}

/** Reorder sources within a notebook */
export async function reorderSources(
  notebookId: string,
  sourceIds: string[]
): Promise<void> {
  await fetchJSON<{ ok: boolean }>(
    `${API}/notebooks/${notebookId}/sources/reorder`,
    {
      method: "POST",
      body: { source_ids: sourceIds },
    }
  );
  await loadNotebook(notebookId);
}

// ── Streaming chat ─────────────────────────────────────────────────────────
//
// The desktop has no renderer-side SSE transport: the backend stream is
// consumed in the Electron main process, which forwards raw response chunks
// over IPC to the renderer. This helper wraps that event channel in a
// reader-shaped API so the UI can keep the WEB_VERSION parse loop (line
// buffer, `data: ` lines, [DONE] marker) unchanged.

export interface NotebookStreamReadResult {
  done: boolean;
  value: string;
}

export interface NotebookStreamReader {
  /** Resolves with the next chunk, or { done: true } at end of stream. */
  read(): Promise<NotebookStreamReadResult>;
  /** Abort the in-flight backend request (safe to call multiple times). */
  abort(): void;
}

const activeStreamReaders = new Map<string, NotebookStreamReader>();

export function abortActiveNotebookChatStreams(): void {
  activeStreamReaders.forEach((reader) => reader.abort());
  activeStreamReaders.clear();
}

/**
 * Open a streaming chat request to the backend. The main process owns the
 * fetch (session token attached) and streams decoded text chunks to the
 * renderer. Pass an AbortSignal (e.g. from an AbortController) to cancel;
 * cancellation is delivered to the main process which destroys the request.
 */
export async function openNotebookChatStream(
  notebookId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
  sourceIds?: string[] | null,
  model?: string | null,
  provider?: string | null
): Promise<NotebookStreamReader> {
  const { requestId } = await window.anakotDesktop.notebookChatStreamStart({
    notebookId,
    message,
    history,
    sourceIds: sourceIds && sourceIds.length ? sourceIds : null,
    model: model ?? null,
    provider: provider ?? null,
  });

  let buffer: Array<string> = [];
  let ended = false;
  let endError: Error | null = null;
  let pendingResolve: ((r: NotebookStreamReadResult) => void) | null = null;

  const flush = () => {
    if (pendingResolve && (buffer.length > 0 || ended)) {
      const resolve = pendingResolve;
      pendingResolve = null;
      if (buffer.length > 0) {
        resolve({ done: false, value: buffer.shift() as string });
      } else if (endError) {
        resolve({ done: true, value: "" });
      } else {
        resolve({ done: true, value: "" });
      }
    }
  };

  const unsubscribe = window.anakotDesktop.onNotebookChatStreamData(
    (event) => {
      if (event.requestId !== requestId) return;
      if (event.type === "chunk") {
        buffer.push(event.text);
        flush();
      } else if (event.type === "done") {
        ended = true;
        flush();
      } else if (event.type === "error") {
        endError = new Error(event.message || "Chat stream failed");
        ended = true;
        flush();
      }
    }
  );

  const onAbort = () => {
    void window.anakotDesktop.notebookChatStreamAbort(requestId);
  };

  const reader: NotebookStreamReader = {
    read(): Promise<NotebookStreamReadResult> {
      if (buffer.length > 0) {
        return Promise.resolve({ done: false, value: buffer.shift() as string });
      }
      if (ended) {
        if (endError) {
          // Surface the backend error once, then end the stream.
          const err = endError;
          endError = null;
          return Promise.reject(err);
        }
        return Promise.resolve({ done: true, value: "" });
      }
      return new Promise((resolve) => {
        pendingResolve = resolve;
        // Guard against a race where the stream ends between the checks above
        // and the promise being installed.
        queueMicrotask(flush);
      });
    },
    abort() {
      onAbort();
    },
  };

  activeStreamReaders.set(requestId, reader);
  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  // Clean up subscription when the stream terminates (either side).
  const finish = () => {
    unsubscribe();
    activeStreamReaders.delete(requestId);
    signal?.removeEventListener("abort", onAbort);
  };
  const originalRead = reader.read.bind(reader);
  reader.read = () =>
    originalRead().then((result) => {
      if (result.done) finish();
      return result;
    });
  reader.abort = () => {
    finish();
    onAbort();
  };

  return reader;
}
