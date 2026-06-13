# TUI — Anakot Agent

> The Terminal UI (TUI) is a modern chat interface built with **Ink** (React for terminals). It replaces the classic prompt_toolkit CLI with modal overlays, mouse selection, and non-blocking input.

## What & Why

Activated via `anakot --tui`, `ANAKOT_TUI=1`, or config `display.interface: "tui"`.

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  YOUR TERMINAL                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │  Node.js process (Ink/React)                    ││
│  │  - GatewayClient spawns Python gateway          ││
│  │  - JSON-RPC over stdin/stdout pipes             ││
│  │  - Renders React components to terminal         ││
│  └──────────────┬──────────────────────────────────┘│
│                 │ stdin/stdout (pipes)              │
│  ┌──────────────▼──────────────────────────────────┐│
│  │  Python process (tui_gateway.entry)             ││
│  │  - Transport: reads JSON-RPC from stdin         ││
│  │  - Server: dispatches to @method handlers       ││
│  │  - Events: writes JSON-RPC to stdout            ││
│  └──────────────┬──────────────────────────────────┘│
│  ┌──────────────▼──────────────────────────────────┐│
│  │  AIAgent (run_agent.py)                         ││
│  │  - LLM conversation + tool calling loop         ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

1. **Node/Ink** (`ui-tui/src/`) — React terminal UI. GatewayClient spawns Python subprocess, communicates via JSON-RPC over pipes.
2. **Python gateway** (`tui_gateway/`) — entry.py (boot), server.py (ALL @method RPC handlers), slash_worker.py (persistent CLI subprocess), transport.py (Stdio/WS/Tee transports), ws.py (WebSocket for dashboard).
3. **AIAgent** (`run_agent.py`) — LLM conversation + tool calling loop.

## Wire Protocol

Everything between Node and Python is **newline-delimited JSON-RPC 2.0**:

**Request (Node → Python):**
```json
{"jsonrpc": "2.0", "id": "abc123", "method": "session.create", "params": {"cols": 120}}
```

**Response (Python → Node):**
```json
{"jsonrpc": "2.0", "id": "abc123", "result": {"session_id": "20260609_120000_abc", "info": {...}}}
```

**Event (Python → Node, no response expected):**
```json
{"jsonrpc": "2.0", "method": "event", "params": {"type": "message.delta", "session_id": "...", "payload": {"text": "Hello"}}}
```

### Key Event Types

| Event | Description |
|-------|-------------|
| `gateway.ready` | Gateway boot complete, includes skin data |
| `session.info` | Session metadata update |
| `status.update` | Status bar text (running, compressing, etc.) |
| `thinking.delta` | Reasoning/thinking text stream |
| `message.start` | Agent starts composing a message |
| `message.delta` | Streaming text token |
| `message.complete` | Message finished |
| `tool.start` / `tool.progress` / `tool.complete` | Tool call lifecycle |
| `subagent.*` | Subagent spawn/completion events |
| `notification.show` / `notification.clear` | Credit warnings, etc. |
| `skin.changed` | Theme update |

## Launch Flow

1. You type `anakot --tui` (or `ANAKOT_TUI=1 anakot`)
2. Python's `main.py` decides TUI mode via `_wants_tui_early()`
3. `_make_tui_argv()` builds the Node command
4. `subprocess.call()` spawns the Node TUI as a child process
5. Node's `entry.tsx` creates `new GatewayClient()` and calls `.start()`
6. `GatewayClient.start()` spawns `python -m tui_gateway.entry`
7. Python's `entry.py` installs signal handlers, starts MCP discovery, sends `gateway.ready`, enters stdin dispatch loop
8. Node receives `gateway.ready`, fetches `commands.catalog`, creates or resumes a session
9. You type a prompt → Node sends `session.prompt` RPC → Python builds AIAgent → agent loop runs → `message.delta` events stream back token by token

## Key Files — TypeScript Side (`ui-tui/src/`)

| File | Role |
|------|------|
| `entry.tsx` | Boot: reset terminal modes, spawn gateway, render Ink `<App>` |
| `gatewayClient.ts` | Core class: spawns Python subprocess, reads stdout, parses JSON, dispatches events |
| `app.tsx` | Root React component |
| `app/useMainApp.ts` | Main orchestrator hook |
| `app/turnController.ts` | Per-turn state machine |
| `app/useSessionLifecycle.ts` | Session CRUD |
| `app/createGatewayEventHandler.ts` | Event handler factory |
| `app/slash/registry.ts` | Client-side slash command registry |
| `config/env.ts` | Environment variable parsing |

## Key Files — Python Side (`tui_gateway/`)

| File | Role |
|------|------|
| `entry.py` | Boot: signal handlers, MCP discovery, `gateway.ready` event, stdin dispatch loop |
| `server.py` (~8470 lines) | ALL RPC handlers via `@method("...")` decorator |
| `slash_worker.py` | Persistent AnakotCLI subprocess per session |
| `transport.py` | Transport abstraction layer |
| `ws.py` | WebSocket transport for dashboard/remote mode |
| `event_publisher.py` | Dashboard event mirroring |
| `render.py` | Rich output rendering bridge |

## How to Launch

```bash
# Production
anakot --tui
anakot --tui --resume <id>      # Resume a specific session
ANAKOT_TUI=1 anakot             # Same as --tui

# Development (live reload)
cd ui-tui
npm install           # First time only
npm run dev           # Watch mode
# In another terminal:
anakot --tui --dev    # Uses tsx instead of prebuilt dist

# Production Build
cd ui-tui
npm run build         # esbuild → dist/entry.js
```

## Slash Commands (Client-Side)

| Command | What it does |
|---------|-------------|
| `/help` | Show commands + hotkeys |
| `/quit` or `/exit` | Exit TUI |
| `/clear` or `/new` | Start new session |
| `/status` | Show live session info |
| `/title <name>` | Set session title |
| `/compact [on/off/toggle]` | Toggle compact transcript |
| `/details [hidden/collapsed/expanded/cycle]` | Control thinking/tools visibility |
| `/copy [n]` | Copy last assistant message to clipboard |
| `/paste` | Attach clipboard image |
| `/logs [n]` | View gateway stderr tail |
| `/update` | Update Anakot (exits TUI with code 42) |
| `/redraw` | Force UI repaint |

## Configuration

```yaml
# ~/.anakot/config.yaml
display:
  interface: "tui"                    # "cli" = classic REPL, "tui" = Ink TUI
  busy_input_mode: "interrupt"        # interrupt | queue | steer
  tui_auto_resume_recent: false       # Auto-resume most recent session on launch
  tui_status_indicator: "kaomoji"     # kaomoji | emoji | unicode | ascii
  show_reasoning: false               # Show thinking/reasoning text
  streaming: false                    # Enable token streaming
  bell_on_complete: false             # Terminal bell when turn completes
```

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANAKOT_TUI=1` | Force TUI mode |
| `ANAKOT_TUI_RESUME=<id>` | Auto-resume session on launch |
| `ANAKOT_TUI_QUERY="..."` | Auto-submit a query on launch |
| `ANAKOT_TUI_IMAGE=<path>` | Auto-attach an image |
| `ANAKOT_TUI_DIR=<path>` | Use prebuilt TUI at this path |
| `ANAKOT_TUI_GATEWAY_URL=ws://...` | Connect to existing gateway (dashboard/remote) |
| `ANAKOT_TUI_FPS=1` | Show FPS overlay |
| `ANAKOT_TUI_INLINE=1` | Render in primary buffer (no alternate screen) |
| `ANAKOT_TUI_DISABLE_MOUSE=1` | Disable mouse tracking |

## Dashboard Mode (Web-Based TUI)

The dashboard embeds the **real** `anakot --tui` — not a rewrite. The TUI's skin engine still handles all content styling; the dashboard just provides the terminal chrome.

### Full Chain

```
Browser (ChatPage.tsx, 937 lines)
  └─ xterm.js Terminal (WebGL, Unicode 11, FitAddon)
       │ onData   → keystrokes → WebSocket → PTY master
       │ write()  ← PTY output bytes
       ↕
  WebSocket /api/pty?token=<session>&channel=<uuid>
       ↕
  FastAPI pty_ws (web_server.py)
       ↕
  PtyBridge (pty_bridge.py)
       ↕
  POSIX PTY master/slave
       ↕
  anakot --tui  (Node → tui_gateway → AIAgent)
```

### Dual WebSocket Architecture

| WebSocket | Direction | Purpose |
|-----------|-----------|---------|
| `/api/pty` | Bidirectional | Raw ANSI bytes (terminal I/O) |
| `/api/ws` | Bidirectional | JSON-RPC tool events for sidebar |
| `/api/pub` | TUI → Server | TUI child publishes events (sidecar) |
| `/api/events` | Server → Sidebar | React sidebar subscribes to channel |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "gateway exited" | Check `~/.anakot/logs/tui_gateway_crash.log` |
| "no TTY" | TUI needs a real terminal (not piped/redirected) |
| Blank screen on launch | Try `ANAKOT_TUI_NO_EARLY_DISABLE=1` |
| Slow startup on Termux | esbuild rebuild is skipped if bundle is fresh |
| High memory usage | TUI has a memory monitor; auto-dumps heap at critical levels |
| Mouse not working | Try `/mouse on` or `ANAKOT_TUI_MOUSE_TRACKING=1` |

## See Also

- **[[CLI Guide]]** — Classic prompt_toolkit CLI interface
- **[[Web Dashboard]]** — Browser-based control panel (embeds the TUI)
- **[[Configuration]]** — Config file, providers, models, options
