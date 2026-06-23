# Web Dashboard — Anakot Agent

> The web dashboard is a browser-based control panel for Anakot. The chat tab embeds the **real TUI** via PTY + xterm.js — not a reimplementation.

## What It Is

A **control panel in your browser** at `http://127.0.0.1:9119`. Instead of editing config files or running CLI commands, you get a visual interface for sessions, config, models, logs, cron jobs, skills, and more.

## Two Halves

```
┌─────────────────────────────────────────────────┐
│  YOUR BROWSER (Frontend)                        │
│  React + TypeScript + Vite                      │
│  Pages: Sessions, Chat, Config, Models, etc.    │
│  web/src/  →  built to  →  web_dist/           │
└────────────────────┬────────────────────────────┘
                     │ HTTP + WebSocket
┌────────────────────┴────────────────────────────┐
│  PYTHON BACKEND (FastAPI)                       │
│  anakot_cli/web_server.py  (~9800 lines)        │
│  Port 9119                                      │
│  Serves API endpoints + static frontend files   │
└─────────────────────────────────────────────────┘
```

## How to Start

```bash
anakot dashboard                          # default port 9119
anakot dashboard --port 8080              # custom port
anakot dashboard --host 0.0.0.0 --insecure  # access from other machines (no auth!)
anakot dashboard --stop                   # stop it
```

Then open `http://127.0.0.1:9119` in your browser.

## Key Files

| File | Purpose |
|------|---------|
| `anakot_cli/web_server.py` (~9814 lines) | FastAPI backend — THE server file |
| `anakot_cli/pty_bridge.py` | PTY bridge for embedded chat (POSIX-only) |
| `anakot_cli/dashboard_auth/` | Auth middleware, OAuth, WS tickets, cookies |
| `web/src/` | Frontend source (React+TS+Vite) |
| `anakot_cli/web_dist/` | Built static files (served by FastAPI) |
| `anakot_state.py` | SessionDB (SQLite + FTS5) |

## Auth Modes

| Mode | When | How |
|------|------|-----|
| **Loopback** (default) | Accessing from `127.0.0.1` | Token injected into HTML as `window.__ANAKOT_SESSION_TOKEN__`, sent via `X-Anakot-Session-Token` header. WS uses `?token=` query param. |
| **Gated** (non-loopback) | Accessing from another machine | OAuth login flow. Cookies + single-use "tickets" for WebSocket connections. |
| **`--insecure`** | Debugging | Skips auth gate, allows any peer. |

## Key API Endpoints

| What you see | API | Does |
|--------------|-----|------|
| Status page | `GET /api/status` | Version, gateway PID, active sessions |
| Config editor | `GET /api/config` + `GET /api/config/schema` | Reads config.yaml + field descriptions |
| Save config | `PUT /api/config` | Writes to config.yaml |
| Model picker | `GET /api/model/options` | Lists ALL providers + models |
| Switch model | `POST /api/model/set` | Assigns model to main/aux slot |
| Session list | `GET /api/sessions` | Paginated sessions with search |
| Search sessions | `GET /api/sessions/search` | Full-text search across messages |
| Gateway restart | `POST /api/gateway/restart` | Spawns restart in background |
| Update Anakot | `POST /api/anakot/update` | Spawns update in background |
| Themes | `GET /api/dashboard/themes` + `PUT /api/dashboard/theme` | List/set themes |
| Plugins | `GET /api/dashboard/plugins` | List discovered plugins |

## WebSocket Endpoints

| WS | Purpose |
|----|---------|
| `/api/pty` | ANSI terminal I/O (anakot --tui behind PTY) |
| `/api/ws` | JSON-RPC tool events for sidebar |
| `/api/pub` | TUI child publishes events (sidecar) |
| `/api/events` | React sidebar subscribes to channel |

## The Chat Tab (Embedded TUI)

**This is the key insight: the chat tab is NOT a React chat UI. It's the real `anakot --tui` running inside xterm.js.**

### Full Chain

```
Browser (ChatPage.tsx, 937 lines)
  └─ xterm.js Terminal (WebGL, Unicode 11, FitAddon)
       │ onData   → keystrokes → WS → PTY master
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

### Dual WS Architecture

The chat uses **two parallel WebSocket connections**:

1. **`/api/pty`** — raw ANSI bytes (terminal I/O). Keystrokes go down, VT100 output comes up.
2. **`/api/ws`** — structured JSON-RPC events for the React sidebar (tool calls, model info, etc.).

Events flow: TUI child → `/api/pub` (sidecar) → server fans out → `/api/events` → React sidebar.

## Frontend Pages

| Page | What |
|------|------|
| Sessions | List/search all chat sessions |
| Chat | Embedded TUI terminal |
| Analytics | Usage stats |
| Models | Provider/model management |
| Logs | Live log tail |
| Cron | Scheduled job management |
| Skills | Skill browser |
| Plugins | Plugin manager |
| MCP | MCP server config |
| Channels | Messaging platform config |
| Webhooks | Webhook management |
| Pairing | Device pairing |
| Profiles | Profile management |
| Config | Full config editor |
| Env | Environment variables editor |
| System | System info |
| Docs | Documentation links |

## Theme System

Built-in themes: **Anakot Teal** (default), **Midnight**, **Ember**, **Mono**, **Cyberpunk**, **Rosé**, **callmemo Blue**

Custom themes: drop YAML files into `~/.anakot/dashboard-themes/`. Each theme controls:
- Color palette (background, foreground, accents)
- Typography (fonts, sizes, spacing)
- Layout (border radius, density)
- Custom images (background, hero, logo)
- Custom CSS
- Component-level style overrides

## Plugin System

Plugins extend the dashboard with new tabs. Discovered from:
- `~/.anakot/plugins/<name>/dashboard/manifest.json` (user-installed)
- `<repo>/plugins/<name>/dashboard/manifest.json` (bundled)

Each plugin can:
- Add a new sidebar tab
- Register "slots" to inject UI into existing pages
- Serve static JS/CSS assets
- Mount backend API routes at `/api/plugins/<name>/`

## Data Flow Examples

```
You click "Save Config"
  → Frontend calls PUT /api/config
  → Backend writes to ~/.anakot/config.yaml
  → Backend responds {ok: true}
  → Frontend shows success toast

You click "Restart Gateway"
  → Frontend calls POST /api/gateway/restart
  → Backend spawns "anakot gateway restart" as background process
  → Frontend polls /api/actions/gateway-restart/status
  → Shows live log tail until process exits

You open Chat tab
  → Frontend opens WS /api/pty?token=xxx
  → Backend spawns "anakot --tui" behind a PTY
  → ANSI bytes flow: TUI → PTY → WebSocket → xterm.js
  → Keystrokes flow: browser → WebSocket → PTY → TUI
  → Simultaneously: WS /api/ws carries JSON-RPC for sidebar
```

## Storage

| What | Where |
|------|-------|
| Config | `~/.anakot/config.yaml` |
| API keys | `~/.anakot/.env` |
| Logs | `~/.anakot/logs/` |
| Custom themes | `~/.anakot/dashboard-themes/*.yaml` |
| User plugins | `~/.anakot/plugins/` |
| Session DB | `~/.anakot/state.db` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank chat tab | Rebuild frontend: `cd web && npm run build` |
| "gateway exited" in TUI | Check `~/.anakot/logs/tui_gateway_crash.log` |
| Config changes not saving | Check file permissions on `~/.anakot/config.yaml` |
| Dashboard not loading | Verify `anakot dashboard` is running on port 9119 |
| WebSocket connection fails | Check auth token; try loopback (127.0.0.1) first |

## See Also

- **[[TUI Guide]]** — The TUI that the dashboard embeds
- **[[Configuration]]** — Config file, providers, models, options
- **[[Architecture]]** — How it works under the hood
