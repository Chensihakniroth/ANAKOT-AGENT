// NotebookLLM — TypeScript types and nanostore atoms

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
  sources: NotebookSource[];
  created_at: string;
  updated_at: string;
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

/** Whether the notebook overlay is open */
export const $notebookOverlayOpen = atom<boolean>(false);

// ── Actions ────────────────────────────────────────────────────────────────

const API = "/api";

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
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
    body: JSON.stringify({ title }),
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
    body: JSON.stringify({ title }),
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

/** Delete a notebook */
export async function deleteNotebook(id: string): Promise<void> {
  await fetchJSON(`${API}/notebooks/${id}`, { method: "DELETE" });
  $notebooks.set($notebooks.get().filter((n) => n.id !== id));
  const cur = $currentNotebook.get();
  if (cur?.id === id) {
    $currentNotebook.set(null);
  }
}

/** Upload a file as a source */
export async function uploadSource(
  notebookId: string,
  file: File
): Promise<NotebookSource> {
  $notebookUploading.set(true);
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/notebooks/${notebookId}/sources/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    const src: NotebookSource = await res.json();
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
      body: JSON.stringify({ url }),
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

/** Update source summary */
export async function updateSourceSummary(
  notebookId: string,
  sourceId: string,
  summary: string
): Promise<void> {
  await fetchJSON(
    `${API}/notebooks/${notebookId}/sources/${sourceId}/summary`,
    {
      method: "PUT",
      body: JSON.stringify({ summary }),
    }
  );
}

/** Get combined context from all sources */
export async function getNotebookContext(
  notebookId: string
): Promise<NotebookContext> {
  return fetchJSON<NotebookContext>(
    `${API}/notebooks/${notebookId}/context`
  );
}

/** Get notebook overview with summaries */
export async function getNotebookOverview(
  notebookId: string
): Promise<NotebookOverview> {
  return fetchJSON<NotebookOverview>(
    `${API}/notebooks/${notebookId}/overview`
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
