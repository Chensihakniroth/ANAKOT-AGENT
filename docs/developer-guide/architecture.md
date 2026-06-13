# Architecture — Anakot Agent

> This page is the top-level map of Anakot Agent internals. Use it to orient yourself in the codebase, then dive into subsystem-specific docs for implementation details.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Entry Points                                  │
│                                                                      │
│  CLI (cli.py)    Gateway (gateway/run.py)    ACP (acp_adapter/)     │
│  Batch Runner    API Server                  Python Library          │
└──────────┬──────────────┬───────────────────────┬───────────────────┘
           │              │                       │
           ▼              ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AIAgent (run_agent.py)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Prompt       │  │ Provider     │  │ Tool         │               │
│  │ Builder      │  │ Resolution   │  │ Dispatch     │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                       │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐               │
│  │ Compression  │  │ 3 API Modes  │  │ Tool Registry│               │
│  │ & Caching    │  │ chat_compl.  │  │ (registry.py)│               │
│  │              │  │ codex_resp.  │  │ 60+ tools    │               │
│  │              │  │ anthropic    │  │ 28 toolsets  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────┴─────────────────┴─────────────────┴───────────────────────┘
           │                                    │
           ▼                                    ▼
┌───────────────────┐              ┌──────────────────────┐
│ Session Storage   │              │ Tool Backends         │
│ (SQLite + FTS5)   │              │ Terminal (6 backends) │
│ anakot_state.py   │              │ Browser (5 backends)  │
│ gateway/session.py│              │ Web (4 backends)      │
└───────────────────┘              │ MCP (dynamic)         │
                                   │ File, Vision, etc.    │
                                   └──────────────────────┘
```

## Directory Structure

```
anakot-agent/
├── run_agent.py              # AIAgent — core conversation loop (~12k LOC)
├── cli.py                    # AnakotCLI — interactive terminal UI (~11k LOC)
├── model_tools.py            # Tool discovery, schema collection, dispatch
├── toolsets.py               # Tool groupings and platform presets
├── anakot_state.py           # SQLite session/state database with FTS5
├── anakot_constants.py       # get_anakot_home(), profile-aware paths
├── anakot_logging.py         # setup_logging() — agent.log / errors.log / gateway.log
├── anakot_bootstrap.py       # MUST be first import (UTF-8 on Windows)
├── batch_runner.py           # Batch trajectory generation
│
├── agent/                    # Agent internals
│   ├── prompt_builder.py     # System prompt assembly
│   ├── context_engine.py     # ContextEngine ABC (pluggable)
│   ├── context_compressor.py # Default engine — lossy summarization
│   ├── prompt_caching.py     # Anthropic prompt caching
│   ├── auxiliary_client.py   # Auxiliary LLM for side tasks
│   ├── model_metadata.py     # Model context lengths, token estimation
│   ├── display.py            # Spinner, tool preview formatting
│   ├── memory_manager.py     # Memory manager orchestration
│   └── trajectory.py         # Trajectory saving helpers
│
├── anakot_cli/               # CLI subcommands and setup
│   ├── main.py               # Entry point — all `anakot` subcommands
│   ├── config.py             # DEFAULT_CONFIG, OPTIONAL_ENV_VARS, migration
│   ├── commands.py           # COMMAND_REGISTRY — central slash command definitions
│   ├── auth.py               # PROVIDER_REGISTRY, credential resolution
│   ├── runtime_provider.py   # Provider → api_mode + credentials
│   ├── models.py             # Model catalog, provider model lists
│   ├── setup.py              # Interactive setup wizard
│   ├── skin_engine.py        # CLI theming engine
│   ├── plugins.py            # PluginManager — discovery, loading, hooks
│   ├── web_server.py         # FastAPI dashboard server (~9800 lines, port 9119)
│   ├── pty_bridge.py         # PTY bridge for embedded TUI (POSIX-only)
│   └── dashboard_auth/       # Auth middleware, OAuth, WS tickets, cookies
│
├── tools/                    # Tool implementations (one file per tool)
│   ├── registry.py           # Central tool registry
│   ├── terminal_tool.py      # Terminal orchestration
│   ├── process_registry.py   # Background process management
│   ├── file_tools.py         # read_file, write_file, patch, search_files
│   ├── web_tools.py          # web_search, web_extract
│   ├── browser_tool.py       # Browser automation tools
│   ├── code_execution_tool.py # execute_code sandbox
│   ├── delegate_tool.py      # Subagent delegation
│   └── environments/         # Terminal backends (local, docker, ssh, modal, daytona, singularity)
│
├── gateway/                  # Messaging platform gateway
│   ├── run.py                # GatewayRunner — message dispatch
│   ├── session.py            # SessionStore — conversation persistence
│   ├── delivery.py           # Outbound message delivery
│   ├── pairing.py            # DM pairing authorization
│   ├── hooks.py              # Hook discovery and lifecycle events
│   ├── builtin_hooks/        # Extension point for always-registered hooks
│   └── platforms/            # 20+ adapters: telegram, discord, slack, whatsapp,
│                             #   signal, matrix, mattermost, email, sms,
│                             #   dingtalk, feishu, wecom, weixin, bluebubbles,
│                             #   qqbot, homeassistant, webhook, api_server, yuanbao
│
├── ui-tui/                   # TUI frontend (TypeScript/React/Ink)
│   ├── src/
│   │   ├── entry.tsx         # Boot entry point
│   │   ├── gatewayClient.ts  # Python subprocess manager + JSON-RPC
│   │   ├── app.tsx           # Root React component
│   │   └── app/              # Hooks, state, components
│   ├── packages/anakot-ink/  # Custom Ink fork
│   └── dist/                 # Built output (entry.js)
│
├── tui_gateway/              # TUI backend (Python)
│   ├── entry.py              # Boot + stdin dispatch loop
│   ├── server.py             # ALL RPC handlers (~8470 lines)
│   ├── slash_worker.py       # Persistent CLI subprocess
│   ├── transport.py          # Transport abstraction
│   ├── ws.py                 # WebSocket transport
│   ├── event_publisher.py    # Dashboard event mirroring
│   └── render.py             # Rich output bridge
│
├── acp_adapter/              # ACP server (VS Code / Zed / JetBrains)
├── cron/                     # Scheduler (jobs.py, scheduler.py)
├── plugins/                  # Plugin system
│   ├── model-providers/      # Inference backend plugins
│   ├── memory/               # Memory provider plugins
│   ├── context_engine/       # Context engine plugins
│   ├── image_gen/            # Image generation providers
│   ├── kanban/               # Multi-agent kanban board
│   └── <others>/             # disk-cleanup, google_meet, spotify, etc.
│
├── skills/                   # Bundled skills (always available)
├── optional-skills/          # Official optional skills (install explicitly)
├── web/                      # Dashboard frontend source (React+TS+Vite)
├── tests/                    # Pytest suite (~17k tests across ~900 files)
└── scripts/                  # run_tests.sh, release.py, auxiliary scripts
```

## Data Flow

### CLI Session

```
User input → AnakotCLI.process_input()
  → AIAgent.run_conversation()
    → prompt_builder.build_system_prompt()
    → runtime_provider.resolve_runtime_provider()
    → API call (chat_completions / codex_responses / anthropic_messages)
    → tool_calls? → model_tools.handle_function_call() → loop
    → final response → display → save to SessionDB
```

### Gateway Message

```
Platform event → Adapter.on_message() → MessageEvent
  → GatewayRunner._handle_message()
    → authorize user
    → resolve session key
    → create AIAgent with session history
    → AIAgent.run_conversation()
    → deliver response back through adapter
```

### Cron Job

```
Scheduler tick → load due jobs from jobs.json
  → create fresh AIAgent (no history)
  → inject attached skills as context
  → run job prompt
  → deliver response to target platform
  → update job state and next_run
```

## Major Subsystems

### Agent Loop

The synchronous orchestration engine (AIAgent in `run_agent.py`). Handles provider selection, prompt construction, tool execution, retries, fallback, callbacks, compression, and persistence. Supports three API modes for different provider backends.

### Prompt System

- `prompt_builder.py` — assembles the ordered system-prompt tiers (stable → context → volatile)
- `context_compressor.py` — summarizes middle conversation turns when context exceeds thresholds
- Memory injection — MEMORY.md and USER.md injected as frozen snapshot at session start

### Provider Resolution

A shared runtime resolver used by CLI, gateway, cron, ACP, and auxiliary calls. Maps (provider, model) tuples to (api_mode, api_key, base_url). Handles 18+ providers, OAuth flows, credential pools, and alias resolution.

### Tool System

Central tool registry (`tools/registry.py`) with 60+ registered tools across ~28 toolsets. Each tool file self-registers at import time. The registry handles schema collection, dispatch, availability checking, and error wrapping. Terminal tools support 6 backends (local, Docker, SSH, Daytona, Modal, Singularity).

### Session Persistence

SQLite-based session storage with FTS5 full-text search. Sessions have lineage tracking (parent/child across compressions), per-platform isolation, and atomic writes with contention handling.

### Messaging Gateway

Long-running process with 20+ platform adapters, unified session routing, user authorization (allowlists + DM pairing), slash command dispatch, hook system, cron ticking, and background maintenance.

### Plugin System

Four discovery sources (later overrides earlier):
1. Bundled: `<repo>/plugins/<name>/`
2. User: `~/.anakot/plugins/<name>/`
3. Project: `./.anakot/plugins/<name>/`
4. Pip: `anakot_agent.plugins` entry points

Each plugin needs `plugin.yaml` + `__init__.py` with `register(ctx)`.

### Cron

First-class agent tasks (not shell tasks). Jobs store in JSON, support multiple schedule formats (`"30m"`, `"every 2h"`, `"0 9 * * *"`, ISO timestamp), can attach skills and scripts, and deliver to any platform.

### TUI Gateway

Python JSON-RPC backend for the Ink/React terminal UI. Handles session lifecycle, agent building, slash command dispatch, and event publishing. Communicates with Node.js frontend via stdin/stdout pipes (JSON-RPC 2.0).

### Web Dashboard

FastAPI server (`anakot_cli/web_server.py`, ~9800 lines) serving:
- REST API endpoints for config, sessions, models, cron, skills
- WebSocket endpoints for embedded TUI (PTY + xterm.js)
- Static React frontend (`web_dist/`)

## Design Principles

| Principle | What it means in practice |
|-----------|--------------------------|
| **Prompt stability** | System prompt doesn't change mid-conversation. No cache-breaking mutations except explicit user actions (`/model`). |
| **Observable execution** | Every tool call is visible to the user via callbacks. Progress updates in CLI (spinner) and gateway (chat messages). |
| **Interruptible** | API calls and tool execution can be cancelled mid-flight by user input or signals. |
| **Platform-agnostic core** | One AIAgent class serves CLI, gateway, ACP, batch, and API server. Platform differences live in the entry point, not the agent. |
| **Loose coupling** | Optional subsystems (MCP, plugins, memory providers) use registry patterns and `check_fn` gating, not hard dependencies. |
| **Profile isolation** | Each profile gets its own config, memory, sessions, and gateway PID. Multiple profiles run concurrently. |
| **Lazy imports** | Everywhere to keep startup fast (< 240 ms for OpenAI SDK). |
| **Exact-pinned dependencies** | No ranges — prevents supply-chain attacks. |

## File Dependency Chain

```
anakot_bootstrap.py  (MUST be first import — UTF-8 on Windows)
       ↑
anakot_constants.py  (no deps — get_anakot_home())
       ↑
anakot_logging.py    (depends on anakot_constants)
       ↑
anakot_state.py      (SQLite + FTS5)
       ↑
toolsets.py          (no deps — _ANAKOT_CORE_TOOLS + TOOLSETS)
       ↑
tools/registry.py    (no deps — imported by all tool files)
       ↑
tools/*.py           (each calls registry.register() at import time)
       ↑
model_tools.py       (imports tools/registry + triggers tool discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

This chain means tool registration happens at import time, before any agent instance is created. Any `tools/*.py` file with a top-level `registry.register()` call is auto-discovered — no manual import list needed.

## See Also

- **[[Contributing]]** — How to contribute to Anakot
- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[Skills System]]** — Procedural memory the agent creates and reuses
- **[[Configuration]]** — Config file, providers, models, options
- **[[TUI Guide]]** — Modern terminal UI with Ink/React
- **[[Web Dashboard]]** — Browser-based control panel
