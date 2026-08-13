// NotebookLLM — Main notebook overlay view
// Three-panel layout: source list (left) | chat (center) | summary (right)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getSourceText,
  getNotebookContext,
  reExtractSources,
  getNotebookOverview,
  summarizeNotebook,
  loadChatHistory,
  saveChatMessage,
  clearChatHistory,
  reorderSources,
  renameSource,
  duplicateNotebook,
  openNotebookChatStream,
} from "./notebook-store";
import type { Notebook, NotebookSource } from "./notebook-store";
import { Button } from "@/components/ui/button";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { ModelPickerDialog } from "@/components/model-picker";
import { useState } from "react";
import { CodeHighlight } from "./code-highlight";
import { notify, notifyError } from "@/store/notifications";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  FileText,
  Link,
  Loader2,
  MessageCircle,
  NotebookTabs,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
  Zap,
} from "@/lib/icons";

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
    Array<{ role: "user" | "assistant"; content: string; created_at?: string }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatStreamAbortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
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
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftWidth, setLeftWidth] = useState(256); // px, 0 = collapsed
  const [rightWidth, setRightWidth] = useState(288); // px, 0 = collapsed
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const [scopeToSource, setScopeToSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingSourceName, setEditingSourceName] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_PANEL = 40; // px — below this, panel collapses
  const sources = currentNotebook?.sources ?? [];

  useEffect(() => {
    loadNotebooks();
  }, []);

  // If overlay reopens with notebook already selected (from previous session), reload chat
  useEffect(() => {
    if (currentNotebook) {
      const nbId = currentNotebook.id;
      loadChatHistory(nbId)
        .then((history) => {
          if ($currentNotebook.get()?.id === nbId) {
            setChatMessages(history);
            if (history.length > 0) hasStreamedOnceRef.current = true;
          }
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
    setScopeToSource(false);
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

  const handleDuplicateNotebook = useCallback(
    async (id: string) => {
      try {
        const nb = await duplicateNotebook(id);
        notify({ kind: "success", message: `Duplicated as "${nb.title}"` });
      } catch (err) {
        notifyError("Failed to duplicate notebook", err instanceof Error ? err.message : String(err));
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

  const [summarizing, setSummarizing] = useState(false);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ACCEPTED_EXTENSIONS = [".pdf",".txt",".md",".csv",".json",".py",".js",".ts",".html",".css",".log"];

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentNotebook) return;
      if (file.size > MAX_FILE_SIZE) {
        notifyError(new Error(`${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit`), "File too large");
        e.target.value = "";
        return;
      }
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
            setScopeToSource(false);
          }
          notify({ kind: "success", message: "Source removed" });
        },
      });
    },
    [currentNotebook, selectedSource]
  );

  // ── Batch source delete ────────────────────────────────────────
  const handleBatchDelete = useCallback(() => {
    if (!currentNotebook || selectedSources.size === 0) return;
    const count = selectedSources.size;
    setConfirmDialog({
      message: `Delete ${count} source${count !== 1 ? "s" : ""}?`,
      onConfirm: async () => {
        let deleted = 0;
        for (const srcId of selectedSources) {
          try {
            await deleteSource(currentNotebook.id, srcId);
            deleted++;
          } catch {}
        }
        setSelectedSources(new Set());
        await loadNotebook(currentNotebook.id);
        notify({ kind: "success", message: `Deleted ${deleted} source(s)` });
      },
    });
  }, [currentNotebook, selectedSources]);

  const toggleSourceSelection = useCallback((id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSources = useCallback(() => {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map((s) => s.id)));
    }
  }, [sources, selectedSources]);

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

  // ── Drag-and-drop handler ──────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!currentNotebook) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    // Validate file types and sizes
    const rejected = files.filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return !ACCEPTED_EXTENSIONS.includes(ext);
    });
    if (rejected.length > 0) {
      notifyError(new Error(`Unsupported: ${rejected.map((f) => f.name).join(", ")}`), "File type not supported");
    }
    const tooLarge = files.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooLarge.length > 0) {
      notifyError(new Error(`Too large: ${tooLarge.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(", ")}`), "File exceeds 50MB limit");
    }
    const validFiles = files.filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return ACCEPTED_EXTENSIONS.includes(ext) && f.size <= MAX_FILE_SIZE;
    });
    if (validFiles.length === 0) return;
    let successCount = 0;
    for (const file of validFiles) {
      try {
        await uploadSource(currentNotebook.id, file);
        successCount++;
      } catch (err) {
        notifyError(err, `Failed to upload ${file.name}`);
      }
    }
    if (successCount > 0) {
      notify({ kind: "success", message: `Uploaded ${successCount} of ${validFiles.length} file(s)` });
      await loadNotebook(currentNotebook.id);
      // Auto-summarize sources that don't have summaries
      setSummarizing(true);
      summarizeNotebook(currentNotebook.id)
        .then((r) => { if (r.summarized > 0) loadNotebook(currentNotebook.id); })
        .catch(() => {})
        .finally(() => setSummarizing(false));
    }
  }, [currentNotebook]);

  // ── Markdown export ──────────────────────────────────────────────
  // ── Relative time formatter ─────────────────────────────────────
  const formatRelativeTime = useCallback((iso?: string): string => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, []);

  // ── Citation counts from chat messages (cross-reference) ────────
  const citationCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const msg of chatMessages) {
      if (msg.role !== "assistant") continue;
      const matches = msg.content.matchAll(/\[Source (\d+)\]/g);
      for (const m of matches) {
        const n = parseInt(m[1], 10);
        counts[n] = (counts[n] || 0) + 1;
      }
    }
    return counts;
  }, [chatMessages]);

  const handleExportMarkdown = useCallback(() => {
    if (!currentNotebook) return;
    const lines: string[] = [`# ${currentNotebook.title}
`];
    lines.push(`*Exported from NotebookLLM — ${new Date().toLocaleDateString()}*
`);
    if (overview) {
      lines.push(`## Overview
${overview}
`);
    }
    if (sources.length > 0) {
      lines.push(`## Sources (${sources.length})
`);
      for (const src of sources) {
        lines.push(`### ${src.original_name}`);
        lines.push(`- Type: ${src.source_type} | Words: ${src.word_count ?? 0} | Chars: ${src.char_count ?? 0}`);
        if (src.summary) lines.push(`
${src.summary}
`);
        lines.push("");
      }
    }
    if (chatMessages.length > 0) {
      lines.push(`## Chat History
`);
      for (const msg of chatMessages) {
        const role = msg.role === "user" ? "You" : "AI";
        lines.push(`**${role}:** ${msg.content}
`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentNotebook.title.replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentNotebook, overview, sources, chatMessages]);

  // ── Source reordering ────────────────────────────────────────────
  const handleMoveSource = useCallback(async (sourceId: string, direction: "up" | "down") => {
    if (!currentNotebook) return;
    const ids = sources.map((s) => s.id);
    const idx = ids.indexOf(sourceId);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    try {
      await reorderSources(currentNotebook.id, ids);
    } catch (err) {
      notifyError(err, "Reorder failed");
    }
  }, [currentNotebook, sources]);

  // ── Clear chat history ───────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    if (!currentNotebook) return;
    setConfirmDialog({
      message: "Clear all chat history for this notebook?",
      onConfirm: async () => {
        await clearChatHistory(currentNotebook.id);
        setChatMessages([]);
        hasStreamedOnceRef.current = false;
        notify({ kind: "success", message: "Chat history cleared" });
      },
    });
  }, [currentNotebook]);

  const handleSelectSource = useCallback(
    async (src: NotebookSource) => {
      setSelectedSource(src);
      setSourceText("");
      if (!currentNotebook) return;
      try {
        const text = await getSourceText(currentNotebook.id, src.id);
        setSourceText(text.slice(0, 5000));
      } catch {
        setSourceText("(unable to load source text)");
      }
    },
    [currentNotebook]
  );

  // ── Citation click handler ──────────────────────────────────
  const handleCitationClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("citation://")) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(href.replace("citation://", ""), 10) - 1;
      if (sources[idx]) {
        handleSelectSource(sources[idx]);
      }
    },
    [sources, handleSelectSource]
  );

  // ── Preprocess text: [Source N] → clickable markdown link ──────────
  const preprocessCitations = useCallback(
    (text: string) => text.replace(
      /\[Source (\d+)\]/g,
      "[Source $1](citation://$1)"
    ),
    []
  );

  // ── Suggested follow-up questions (heuristic, no extra API call) ────────
  const suggestedFollowUps = useMemo(() => {
    if (chatMessages.length === 0 || chatLoading) return [];
    const last = chatMessages[chatMessages.length - 1];
    if (last.role !== "assistant" || !last.content) return [];
    const suggestions: string[] = [];

    // If answer cites sources, ask to elaborate on the most-cited one
    const cited = [...last.content.matchAll(/\[Source (\d+)\]/g)].map((m) => parseInt(m[1]));
    if (cited.length > 0) {
      const top = cited.sort((a, b) => cited.filter((x) => x === b).length - cited.filter((x) => x === a).length)[0];
      const src = sources[top - 1];
      if (src) suggestions.push(`Tell me more about ${src.original_name}`);
    }

    // Generic follow-ups based on context
    const lc = last.content.toLowerCase();
    if (lc.includes("summar")) {
      suggestions.push("What are the key takeaways?");
    } else if (lc.includes("differ") || lc.includes("compar") || lc.includes("similar")) {
      suggestions.push("Which source is most relevant for this topic?");
    } else {
      suggestions.push("Can you summarize the main points?");
      suggestions.push("Are there any contradictions between sources?");
    }

    // If multiple sources exist, suggest source-specific question
    if (sources.length > 1 && !suggestions.some((s) => s.includes("source"))) {
      suggestions.push("Which source should I read first?");
    }

    return suggestions.slice(0, 3);
  }, [chatMessages, chatLoading, sources]);

  const handleClickSuggestion = useCallback((q: string) => {
    setChatInput(q);
    chatInputRef.current?.focus();
  }, []);

  // ── Source rename ────────────────────────────────────────────
  const handleStartRename = useCallback((src: NotebookSource) => {
    setEditingSourceId(src.id);
    setEditingSourceName(src.original_name);
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (!editingSourceId || !currentNotebook) return;
    const name = editingSourceName.trim();
    if (!name || name === sources.find((s) => s.id === editingSourceId)?.original_name) {
      setEditingSourceId(null);
      return;
    }
    try {
      await renameSource(currentNotebook.id, editingSourceId, name);
      if (selectedSource?.id === editingSourceId) {
        setSelectedSource((prev) => prev ? { ...prev, original_name: name } : null);
      }
    } catch (e: any) {
      notify({ kind: "error", message: `Rename failed: ${e.message}` });
    }
    setEditingSourceId(null);
  }, [editingSourceId, editingSourceName, currentNotebook, sources, selectedSource]);


  const handleLoadOverview = useCallback(async () => {
    if (!currentNotebook) return;
    try {
      const ov = await getNotebookOverview(currentNotebook.id);
      if (ov.combined && ov.combined !== "No sources yet. Upload sources and generate summaries.") {
        setOverview(ov.combined);
      } else {
        // Fallback: show context stats
        const ctx = await getNotebookContext(currentNotebook.id);
        if (ctx.char_count > 0) {
          const estimatedTokens = Math.ceil(ctx.char_count / 4);
          setOverview(`No summaries yet. Upload sources and click "Summarize all" to generate an overview.\n\nContext: ${ctx.char_count.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens)`);
        } else {
          setOverview("No sources yet. Upload files or add a URL to get started.");
        }
      }
    } catch {
      setOverview("(unable to load overview)");
    }
  }, [currentNotebook]);

  // Auto-refresh overview when notebook loads
  useEffect(() => {
    if (currentNotebook) handleLoadOverview();
  }, [currentNotebook, handleLoadOverview]);

  const handleChat = useCallback(async (textOverride?: string) => {
    const rawInput = (textOverride ?? chatInput).trim();
    if (!rawInput || !currentNotebook) return;
    let question = rawInput;
    // Scope to selected source if toggle is on
    if (scopeToSource && selectedSource) {
      question = `[Focus on source: "${selectedSource.original_name}" (ID: ${selectedSource.id})] ${question}`;
    }
    setChatInput("");
    const userMsg = { role: "user" as const, content: rawInput };
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
      const reader = await openNotebookChatStream(
        currentNotebook.id,
        question,
        updatedMessages.slice(0, -1).slice(-20),
        controller.signal
      );

      let accumulated = "";

      // Add empty assistant message that we'll update progressively
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += value;
        const snap = accumulated;
        setChatMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: snap };
          return next;
        });
      }

      // Persist final accumulated response
      if (accumulated) {
        saveChatMessage(currentNotebook.id, "assistant", accumulated).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Replace the empty assistant bubble with the error instead of appending a second bubble
      setChatMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx].role === "assistant" && next[lastIdx].content === "") {
          next[lastIdx] = { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
        } else {
          next.push({ role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
        }
        return next;
      });
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, currentNotebook, chatMessages, scopeToSource, selectedSource]);

  // ── Chat search highlight ─────────────────────────────────────
  const highlightMatch = useCallback((text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-500/30 text-(--ui-text-primary) rounded px-0.5">{part}</mark>
      ) : (
        part
      )
    );
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Escape: cancel title edit or go back to list
      if (e.key === "Escape" && !e.defaultPrevented) {
        if (editingTitle) {
          setEditingTitle(false);
          return;
        }
        if (currentNotebook) {
          $currentNotebook.set(null);
          return;
        }
      }
      // Ctrl/Cmd + E: Export markdown
      if (mod && e.key === "e") {
        e.preventDefault();
        handleExportMarkdown();
      }
      // Ctrl/Cmd + L: Clear chat
      if (mod && e.key === "l") {
        e.preventDefault();
        handleClearChat();
      }
      // Ctrl/Cmd + F: Search chat
      if (mod && e.key === "f") {
        e.preventDefault();
        setChatSearchOpen((prev) => !prev);
      }
    };
    const keyDown = (e: KeyboardEvent) => {
      // /: focus chat input
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keydown", keyDown);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keydown", keyDown);
    };
  }, [currentNotebook, editingTitle, handleExportMarkdown, handleClearChat]);

  // Track whether user is near the bottom of chat
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80; // px from bottom
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Panel resize drag logic ──────────────────────────────────
  const handleResizeStart = useCallback((which: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(which);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (dragging === "left") {
        const newW = Math.max(0, Math.min(e.clientX - rect.left, 400));
        setLeftWidth(newW < MIN_PANEL ? 0 : newW);
      } else if (dragging === "right") {
        const newW = Math.max(0, Math.min(rect.right - e.clientX, 400));
        setRightWidth(newW < MIN_PANEL ? 0 : newW);
      }
    };

    const onMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  // Auto-scroll chat to bottom during streaming (only if user hasn't scrolled up)
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages]);

    // Shared confirm dialog
  const confirmDialogJSX = confirmDialog && (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-chat-surface-background) p-5 shadow-lg">
        <p className="mb-4 text-sm text-(--ui-text-primary)">
          {confirmDialog.message}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDialog(null)} className="rounded-md border border-(--ui-stroke-secondary) px-3 py-1.5 text-xs text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary)" type="button">Cancel</button>
          <button onClick={async () => { const action = confirmDialog.onConfirm; setConfirmDialog(null); await action(); }} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500" type="button">Confirm</button>
        </div>
      </div>
    </div>
  );

// ── Notebook list view (no notebook selected) ──────────────────────────
  if (!currentNotebook) {
    return (
      <div className="flex h-full flex-col bg-(--ui-chat-surface-background) p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-(--ui-text-primary)">
              Notebooks
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNotebook}
              className="inline-flex items-center gap-1.5 rounded-lg bg-(--ui-accent) px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-(--ui-accent)/90"
              type="button"
            >
              <Plus size={14} /> New Notebook
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-(--ui-stroke-secondary) px-3 py-1.5 text-xs text-(--ui-text-secondary) hover:text-(--ui-text-primary) transition-colors"
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20 text-xs text-(--ui-text-tertiary)">
            <Loader2 size={16} className="animate-spin text-(--ui-accent) mr-2" /> Loading notebooks...
          </div>
        ) : notebooks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 text-(--ui-text-tertiary)">
              <NotebookTabs size={28} />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-(--ui-text-primary)">
              No notebooks yet
            </h3>
            <p className="mb-5 max-w-xs text-xs text-(--ui-text-tertiary)">
              Create a notebook to upload documents, web URLs, or notes for AI-powered Q&A.
            </p>
            <button
              onClick={handleCreateNotebook}
              className="inline-flex items-center gap-1.5 rounded-lg bg-(--ui-accent) px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-(--ui-accent)/90"
              type="button"
            >
              <Plus size={14} /> Create your first notebook
            </button>
          </div>
        ) : (
          <>
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--ui-text-tertiary)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notebooks..."
              className="w-full rounded-lg border border-(--ui-stroke-secondary) bg-transparent pl-9 pr-4 py-2 text-xs text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-tertiary) focus:border-(--ui-accent)"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
                type="button"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.filter((nb) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              if (nb.title.toLowerCase().includes(q)) return true;
              if (nb.source_names?.some((n) => n.toLowerCase().includes(q))) return true;
              return false;
            }).map((nb) => (
              <div
                key={nb.id}
                className="group cursor-pointer rounded-lg border border-(--ui-stroke-secondary) p-3.5 transition-colors hover:border-(--ui-accent)/40 hover:bg-(--ui-surface-elevated)"
                onClick={() => handleSelectNotebook(nb)}
              >
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <h3 className="truncate text-xs font-semibold text-(--ui-text-primary)">
                    {nb.title}
                  </h3>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateNotebook(nb.id);
                      }}
                      className="p-1 text-(--ui-text-tertiary) hover:text-(--ui-accent)"
                      type="button"
                      title="Duplicate"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotebook(nb.id);
                      }}
                      className="p-1 text-(--ui-text-tertiary) hover:text-red-400"
                      type="button"
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-(--ui-text-tertiary)">
                  <span>
                    {(nb.source_count ?? 0)} {(nb.source_count ?? 0) === 1 ? "source" : "sources"}
                  </span>
                  <span>{formatRelativeTime(nb.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
        {confirmDialogJSX}
      </div>
    );
  }

  // ── Notebook detail view (three-panel) ─────────────────────────────────
  return (
    <div ref={containerRef} className={`relative flex h-full bg-(--ui-chat-surface-background) ${dragging ? "select-none cursor-col-resize" : ""}`}>
      {/* Left panel: Source list */}
      {leftWidth > 0 && (
      <>
      <div
        className={`flex flex-col border-r border-(--ui-stroke-secondary) transition-colors ${dragOver ? "bg-(--ui-accent)/5 ring-2 ring-inset ring-(--ui-accent)/50" : ""}`}
        style={{ width: leftWidth, minWidth: leftWidth }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Left Panel Navigation Header */}
        <div className="p-3">
          <button
            onClick={() => $currentNotebook.set(null)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-surface-elevated) hover:text-(--ui-text-primary)"
            type="button"
          >
            <ChevronLeft size={14} /> All Notebooks
          </button>
        </div>

        {/* Notebook Title */}
        <div className="px-3 py-2">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                className="flex-1 rounded border border-(--ui-accent) bg-transparent px-2 py-1 text-xs font-medium text-(--ui-text-primary) outline-none"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="text-xs text-(--ui-accent)"
                type="button"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div
              className="group flex cursor-pointer items-center justify-between gap-2"
              onClick={() => {
                setTitleInput(currentNotebook.title);
                setEditingTitle(true);
              }}
              title="Click to edit notebook title"
            >
              <h2 className="truncate text-xs font-semibold text-(--ui-text-primary) hover:text-(--ui-accent) transition-colors">
                {currentNotebook.title}
              </h2>
              <Pencil size={11} className="shrink-0 text-(--ui-text-tertiary) opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {/* Upload & Source Controls */}
        <div className="p-3 space-y-2">
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-(--ui-stroke-secondary) px-3 py-2 text-center text-xs text-(--ui-text-secondary) transition-colors ${dragOver ? "border-(--ui-accent) bg-(--ui-accent)/10" : "hover:border-(--ui-accent) hover:text-(--ui-text-primary)"}`}>
            <Upload size={13} className="text-(--ui-accent)" />
            <span className="text-xs font-medium">
              {uploading ? "Uploading..." : "Add File (PDF, MD, TXT)"}
            </span>
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
              placeholder="Paste URL..."
              className="flex-1 rounded-lg border border-(--ui-stroke-secondary) bg-transparent px-2.5 py-1 text-xs text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-tertiary) focus:border-(--ui-accent)"
            />
            <button
              onClick={handleAddUrl}
              disabled={!urlInput.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--ui-accent) text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              type="button"
              title="Add URL"
              aria-label="Add URL"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Summarize All Action */}
        {sources.length > 0 && (
          <div className="px-3 py-1">
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
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-(--ui-stroke-secondary) px-3 py-1.5 text-xs font-medium text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary) transition-colors disabled:opacity-50"
              type="button"
            >
              {summarizing ? (
                <>
                  <Loader2 size={12} className="animate-spin text-(--ui-accent)" /> Summarizing...
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-(--ui-accent)" /> Summarize Sources
                </>
              )}
            </button>
          </div>
        )}

        {/* Re-extract Warning Banner */}
        {sources.length > 0 && sources.some((s) => (s.word_count ?? 0) === 0) && (
          <div className="px-3 py-1">
            <button
              onClick={handleReExtract}
              disabled={reExtracting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              type="button"
            >
              {reExtracting ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Re-extracting...
                </>
              ) : (
                <>
                  <AlertTriangle size={12} /> Re-extract empty text
                </>
              )}
            </button>
          </div>
        )}

        {/* Source List Section */}
        <div className="flex-1 overflow-y-auto p-2">
          {sources.length > 1 && (
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-(--ui-text-tertiary)">
                <input
                  type="checkbox"
                  checked={selectedSources.size === sources.length && sources.length > 0}
                  onChange={toggleAllSources}
                  className="accent-(--ui-accent)"
                />
                <span>{selectedSources.size > 0 ? `${selectedSources.size} selected` : `Select all (${sources.length})`}</span>
              </label>
              {selectedSources.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="text-[10px] font-medium text-red-400 hover:underline"
                  type="button"
                >
                  Delete selected
                </button>
              )}
            </div>
          )}
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-(--ui-surface-elevated) text-(--ui-text-tertiary)">
                <FileText size={18} />
              </div>
              <p className="text-xs font-medium text-(--ui-text-secondary)">
                No sources added
              </p>
              <p className="text-[10px] text-(--ui-text-quaternary)">
                Upload a file or paste a URL above
              </p>
            </div>
          ) : (
            sources.map((src) => (
              <div
                key={src.id}
                className={`group flex items-center gap-2 rounded-lg p-2 text-xs cursor-pointer transition-colors ${
                  selectedSource?.id === src.id
                    ? "bg-(--ui-accent)/10 text-(--ui-accent)"
                    : "text-(--ui-text-secondary) hover:bg-(--ui-surface-elevated)"
                }`}
                onClick={() => handleSelectSource(src)}
              >
                <input
                  type="checkbox"
                  checked={selectedSources.has(src.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSourceSelection(src.id)}
                  className="shrink-0 accent-(--ui-accent)"
                />
                {src.source_type === "url" ? (
                  <Link size={13} className="shrink-0 text-(--ui-accent)" />
                ) : (
                  <FileText size={13} className="shrink-0 text-(--ui-text-tertiary)" />
                )}
                <div className="min-w-0 flex-1">
                  {editingSourceId === src.id ? (
                    <input
                      autoFocus
                      value={editingSourceName}
                      onChange={(e) => setEditingSourceName(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename();
                        if (e.key === "Escape") setEditingSourceId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent border-b border-(--ui-accent) text-(--ui-text-primary) outline-none text-xs"
                    />
                  ) : (
                    <span
                      className="truncate block font-medium"
                      onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(src); }}
                      title="Double-click to rename"
                    >
                      {src.original_name}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-(--ui-text-tertiary)">
                  {(src.word_count ?? 0).toLocaleString()}w
                  {(src.word_count ?? 0) === 0 && (
                    <AlertTriangle size={10} className="ml-0.5 inline text-amber-400" title="Extraction failed" />
                  )}
                </span>
                <div className="shrink-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveSource(src.id, "up"); }}
                    className="p-0.5 text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
                    type="button"
                    disabled={sources.indexOf(src) === 0}
                    title="Move up"
                  ><ChevronUp size={11} /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveSource(src.id, "down"); }}
                    className="p-0.5 text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
                    type="button"
                    disabled={sources.indexOf(src) === sources.length - 1}
                    title="Move down"
                  ><ChevronDown size={11} /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSource(src.id); }}
                    className="p-0.5 text-(--ui-text-tertiary) hover:text-red-400"
                    type="button"
                    title="Remove source"
                  ><X size={11} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Left resize handle */}
      <div
        onMouseDown={handleResizeStart("left")}
        className="group w-1 cursor-col-resize bg-transparent hover:bg-(--ui-accent)/30 active:bg-(--ui-accent)/50 transition-colors flex items-center justify-center"
        title="Drag to resize panel"
      >
        <div className="h-8 w-px bg-(--ui-stroke-secondary) group-hover:bg-(--ui-accent)" />
      </div>
      </>
      )}

      {/* Center panel: Chat Workspace */}
      <div className="flex flex-1 flex-col min-w-0 bg-(--ui-chat-surface-background)">
        {/* Workspace Top Toolbar */}
        <div className="flex items-center justify-between border-b border-(--ui-stroke-secondary)/40 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs text-(--ui-text-primary) truncate">
              {currentNotebook.title}
            </span>
            {scopeToSource && selectedSource && (
              <span className="inline-flex items-center gap-1 rounded-full bg-(--ui-accent)/15 px-2 py-0.5 text-[10px] font-medium text-(--ui-accent)">
                <Search size={11} /> {selectedSource.original_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              onClick={() => setChatSearchOpen((prev) => !prev)}
              className="flex items-center gap-1 text-(--ui-text-tertiary) hover:text-(--ui-text-primary) transition-colors"
              type="button"
              title="Search chat history (Ctrl+F)"
            >
              <Search size={12} /> Search
            </button>
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1 text-(--ui-text-tertiary) hover:text-(--ui-text-primary) transition-colors"
              type="button"
              title="Export as Markdown (Ctrl+E)"
            >
              <FileText size={12} /> Export
            </button>
            {chatMessages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1 text-(--ui-text-tertiary) hover:text-red-400 transition-colors"
                type="button"
                title="Clear chat history (Ctrl+L)"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Chat Search Bar */}
        {chatSearchOpen && (
          <div className="flex items-center gap-2 border-b border-(--ui-stroke-secondary)/40 px-4 py-2">
            <Search size={13} className="text-(--ui-text-tertiary)" />
            <input
              autoFocus
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search transcript..."
              className="flex-1 bg-transparent text-xs text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-tertiary)"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setChatSearchOpen(false);
                  setChatSearchQuery("");
                }
              }}
            />
            {chatSearchQuery && (
              <span className="text-[10px] text-(--ui-text-tertiary)">
                {chatMessages.filter((m) =>
                  m.content.toLowerCase().includes(chatSearchQuery.toLowerCase())
                ).length} matches
              </span>
            )}
            <button
              onClick={() => { setChatSearchOpen(false); setChatSearchQuery(""); }}
              className="text-[10px] text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
              type="button"
            ><X size={12} /></button>
          </div>
        )}

        {/* Chat messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth">
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-3 text-(--ui-accent)">
                <Sparkles size={28} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-(--ui-text-primary)">
                Ask NotebookLLM Anything
              </h3>
              <p className="mb-5 max-w-xs text-xs text-(--ui-text-tertiary)">
                Synthesize insights or generate notes from your {sources.length} source{sources.length !== 1 ? "s" : ""}
              </p>
              {sources.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {[
                    "Summarize all sources",
                    "Find contradictions",
                    "Create an outline",
                    "Key takeaways",
                  ].map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => handleClickSuggestion(starter)}
                      className="rounded-full border border-(--ui-stroke-secondary) px-3 py-1.5 text-xs text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary) transition-colors"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              msg.role === "user" ? (
                <div key={i} className="group relative ml-16 flex justify-end">
                  <div className="rounded-2xl bg-(--ui-accent)/15 border border-(--ui-accent)/20 px-4 py-2.5 text-xs text-(--ui-text-primary)">
                    {chatSearchQuery ? highlightMatch(msg.content, chatSearchQuery) : msg.content}
                  </div>
                  <div className="absolute -left-12 top-1 hidden items-center gap-1 group-hover:flex">
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.content); notify({ kind: "success", message: "Copied" }); }}
                      className="text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
                      type="button"
                      title="Copy message"
                    ><Copy size={12} /></button>
                    <button
                      onClick={() => {
                        setChatInput(msg.content);
                        setChatMessages(chatMessages.slice(0, i));
                        hasStreamedOnceRef.current = i > 0;
                        chatInputRef.current?.focus();
                      }}
                      className="text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
                      type="button"
                      title="Edit prompt"
                    ><Pencil size={12} /></button>
                  </div>
                </div>
              ) : (
                <div key={i} className="group relative mr-8">
                  {/* Clean, borderless AI assistant response view */}
                  <div
                    data-slot="aui_assistant-message-content"
                    className="text-xs text-(--ui-text-primary) leading-relaxed"
                    onClick={handleCitationClick}
                  >
                    <MarkdownTextContent text={preprocessCitations(msg.content)} isRunning={chatLoading && i === chatMessages.length - 1} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.content); notify({ kind: "success", message: "Copied" }); }}
                      className="text-[10px] text-(--ui-text-tertiary) hover:text-(--ui-text-primary) flex items-center gap-1"
                      type="button"
                    ><Copy size={11} /> Copy</button>
                    {i === chatMessages.length - 1 && !chatLoading && (
                      <button
                        onClick={() => {
                          const lastUserIdx = chatMessages.findLastIndex((m) => m.role === "user");
                          if (lastUserIdx < 0) return;
                          const retryQ = chatMessages[lastUserIdx].content;
                          setChatMessages(chatMessages.slice(0, lastUserIdx));
                          hasStreamedOnceRef.current = lastUserIdx > 0;
                          handleChat(retryQ);
                        }}
                        className="text-[10px] text-(--ui-text-tertiary) hover:text-(--ui-text-primary) flex items-center gap-1"
                        type="button"
                      ><RefreshCw size={11} /> Retry</button>
                    )}
                  </div>
                </div>
              )
            ))
          )}

          {/* Follow-up suggestions */}
          {suggestedFollowUps.length > 0 && !chatLoading && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {suggestedFollowUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleClickSuggestion(q)}
                  className="rounded-full border border-(--ui-stroke-secondary) px-3 py-1 text-[11px] text-(--ui-text-secondary) hover:border-(--ui-accent) hover:text-(--ui-text-primary) transition-colors"
                >
                  <Zap size={10} className="inline mr-1 text-(--ui-accent)" />{q}
                </button>
              ))}
            </div>
          )}
          {chatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.content === "" && (
            <div className="py-2 text-xs text-(--ui-text-tertiary) flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin text-(--ui-accent)" /> Synthesizing answer...
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="p-3">
          <PromptInput
            value={chatInput}
            onChange={setChatInput}
            onSubmit={(val) => handleChat(val)}
            isLoading={chatLoading}
            onStop={() => chatStreamAbortRef.current?.abort()}
            placeholder={chatLoading ? "Waiting for response..." : "Ask about your sources..."}
            fullWidth
            className="mx-auto"
          />
        </div>
      </div>

      {/* Right panel: Source Preview / Overview */}
      {rightWidth > 0 && (
      <>
      {/* Right resize handle */}
      <div
        onMouseDown={handleResizeStart("right")}
        className="group w-1 cursor-col-resize bg-transparent hover:bg-(--ui-accent)/30 active:bg-(--ui-accent)/50 transition-colors flex items-center justify-center"
        title="Drag to resize panel"
      >
        <div className="h-8 w-px bg-(--ui-stroke-secondary) group-hover:bg-(--ui-accent)" />
      </div>
      <div
        className="flex flex-col bg-(--ui-chat-surface-background) border-l border-(--ui-stroke-secondary)/40"
        style={{ width: rightWidth, minWidth: rightWidth }}
      >
        <div className="flex items-center justify-between border-b border-(--ui-stroke-secondary)/40 px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-(--ui-text-primary)">
            {selectedSource ? <FileText size={13} className="text-(--ui-accent)" /> : <Sparkles size={13} className="text-(--ui-accent)" />}
            {selectedSource ? "Source Preview" : "Notebook Overview"}
          </span>
          <div className="flex items-center gap-1 text-xs">
            {!selectedSource && (
              <button
                onClick={handleLoadOverview}
                className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-(--ui-accent) transition-colors hover:bg-(--ui-surface-elevated)"
                type="button"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            )}
            {selectedSource && (
              <button
                onClick={() => setSelectedSource(null)}
                className="rounded-md px-2 py-1 text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-surface-elevated) hover:text-(--ui-text-primary)"
                type="button"
              >
                Overview
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 text-xs text-(--ui-text-secondary)">
          {selectedSource ? (
            <div>
              <h4 className="mb-1.5 font-bold text-xs text-(--ui-text-primary)">
                {selectedSource.original_name}
              </h4>
              <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-(--ui-text-tertiary)">
                <span>{selectedSource.source_type}</span> •
                <span>{(selectedSource.word_count ?? 0).toLocaleString()} words</span>
              </div>
              {selectedSource.summary && (
                <div className="mb-3 border-l-2 border-(--ui-accent) pl-2.5 py-1 text-xs text-(--ui-text-secondary)">
                  <MarkdownTextContent text={selectedSource.summary} isRunning={false} />
                </div>
              )}
              <div className="mt-3">
                {selectedSource.original_name.endsWith(".md") ? (
                  <div className="max-h-96 overflow-y-auto text-xs text-(--ui-text-secondary)" data-slot="aui_assistant-message-content">
                    <MarkdownTextContent text={sourceText || "Loading..."} isRunning={false} />
                  </div>
                ) : (
                  <CodeHighlight code={sourceText || ""} filename={selectedSource.original_name} />
                )}
              </div>
            </div>
          ) : (
            <div data-slot="aui_assistant-message-content">
              {overview ? (
                <MarkdownTextContent text={overview} isRunning={false} />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-(--ui-surface-elevated) text-(--ui-text-tertiary)">
                    <Sparkles size={18} />
                  </div>
                  <p className="text-xs text-(--ui-text-secondary)">
                    No overview yet
                  </p>
                  <p className="text-[10px] text-(--ui-text-tertiary)">
                    Click Refresh to generate one
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Source Citation Index */}
          {!selectedSource && sources.length > 0 && (
            <div className="mt-4 border-t border-(--ui-stroke-secondary)/40 pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-(--ui-text-tertiary)">
                Sources ({sources.length})
              </div>
              <div className="space-y-1">
                {sources.map((src, idx) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectSource(src)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-(--ui-surface-elevated)"
                  >
                    <span className="text-[10px] font-bold text-(--ui-accent)">{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-(--ui-text-primary)">
                      {src.original_name}
                    </span>
                    <span className="shrink-0 text-[10px] text-(--ui-text-tertiary)">
                      {src.word_count?.toLocaleString() ?? 0}w
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {confirmDialogJSX}
    </div>
  );
}
