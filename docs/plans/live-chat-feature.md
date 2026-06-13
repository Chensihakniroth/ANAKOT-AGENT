# Live Chat Feature Implementation Plan

> **Status:** Draft — awaiting approval to start implementation
> **Date:** 2026-06-13
> **Branch:** tui-revamp-design

**Goal:** Add a real-time live chat interface to the Anakot web dashboard — a standalone chat panel where users can send messages to the AI agent and receive streaming responses, without needing the embedded TUI/PTY terminal.

**Architecture:** A new WebSocket-based chat system layered on top of the existing FastAPI server. Messages flow: Browser → WS → FastAPI → AIAgent (via existing `run_conversation`) → streaming response back via WS. Reuses the existing session system and agent loop.

**Source repo:** `D:\School\PROJECT\anakot-agent`
**Estimated effort:** 12-20 hours across 8 tasks
**Estimated code:** ~2,000 new/modified lines across 15 files

---

## Task Summary

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | WS Protocol Design | `docs/plans/live-chat-ws-protocol.md` | 30 min |
| 2 | Backend — WS Route | `anakot_cli/web_server.py` (+250 lines) | 2-3 hrs |
| 3 | Backend — Agent Loop Adapter | `anakot_cli/chat_adapter.py` (new, ~300 lines) | 2-3 hrs |
| 4 | Frontend — Chat Page + Hook | `web/src/pages/LiveChatPage.tsx` (~500 lines), `web/src/hooks/useLiveChat.ts` (~150 lines) | 3-4 hrs |
| 5 | Frontend — Components | `ChatMessage.tsx`, `ChatInput.tsx`, `ToolIndicator.tsx`, `ChatSessionList.tsx` (~340 lines) | 2-3 hrs |
| 6 | Backend — Session API | `web_server.py` (+50 lines), `web/src/lib/api.ts` (+50 lines) | 1-2 hrs |
| 7 | Integration & Testing | `tests/anakot_cli/test_chat_ws.py`, `test_chat_adapter.py` (~350 lines) | 2-3 hrs |
| 8 | Polish & Documentation | Docs, config keys, responsive fixes | 1-2 hrs |

**WebSocket endpoint:** `ws://127.0.0.1:9119/api/chat`
**Frontend route:** `/live-chat`

---

## Full Protocol, task details, and file map

See Obsidian vault: `Anakot Agent/Plans/live-chat-feature.md`
