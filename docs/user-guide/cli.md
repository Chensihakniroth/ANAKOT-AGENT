# CLI Interface — Anakot Agent

> Anakot's classic CLI is a full terminal interface — multiline editing, slash-command autocomplete, conversation history, interrupt-and-redirect, and streaming tool output.

## Running the CLI

```bash
# Start an interactive session (default)
anakot

# Single query mode (non-interactive)
anakot chat -q "Hello"

# With a specific model
anakot chat --model "anthropic/claude-sonnet-4"

# With specific toolsets
anakot chat --toolsets "web,terminal,skills"

# Resume previous sessions
anakot --continue             # Resume the most recent CLI session
anakot --resume <session_id> # Resume a specific session by ID

# TUI mode (modern terminal UI)
anakot --tui

# Web dashboard
anakot dashboard
```

## Interface Layout

The welcome banner shows your model, terminal backend, working directory, available tools, and installed skills at a glance.

### Status Bar

A persistent status bar sits above the input area, updating in real time:

```
⚕ openrouter/owl-alpha │ 12.4K/200K │ [██████░░░░] 6% │ $0.06 │ 15m
```

| Element | Description |
|---------|-------------|
| Model name | Current model (truncated if > 26 chars) |
| Token count | Context tokens used / max context window |
| Context bar | Visual fill indicator with color-coded thresholds |
| Cost | Estimated session cost |
| 🗜️ N | Context compression count |
| ▶ N | Active background tasks |
| Duration | Elapsed session time |

Context color coding:

| Color | Threshold | Meaning |
|-------|-----------|---------|
| Green | < 50% | Plenty of room |
| Yellow | 50–80% | Getting full |
| Orange | 80–95% | Approaching limit |
| Red | ≥ 95% | Near overflow — consider `/compress` |

## Keybindings

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Alt+Enter`, `Ctrl+J`, or `Shift+Enter` | New line (multi-line input) |
| `Ctrl+C` | Interrupt agent (double-press within 2s to force exit) |
| `Ctrl+D` | Exit |
| `Tab` | Accept auto-suggestion or autocomplete slash commands |

> **Windows note:** On Windows Terminal, `Alt+Enter` is captured by the terminal (fullscreen toggle). Use `Ctrl+Enter` or `Ctrl+J` instead.

## Multiline Input

There are two ways to enter multi-line messages:

1. `Alt+Enter`, `Ctrl+J`, or `Shift+Enter` — inserts a new line
2. Backslash continuation — end a line with `\` to continue:

```
❯ Write a function that:\
  1. Takes a list of numbers\
  2. Returns the sum
```

## Interrupting the Agent

You can interrupt the agent at any point:

- **Type a new message + Enter** while the agent is working — it interrupts and processes your new instructions
- **`Ctrl+C`** — interrupt the current operation (press twice within 2s to force exit)

In-progress terminal commands are killed immediately. Multiple messages typed during interrupt are combined into one prompt.

### Busy Input Mode

The `display.busy_input_mode` config key controls what happens when you press Enter while the agent is working:

| Mode | Behavior |
|------|----------|
| `"interrupt"` (default) | Your message interrupts the current operation immediately |
| `"queue"` | Your message is silently queued and sent as the next turn |
| `"steer"` | Your message is injected into the current run via `/steer`, arriving after the next tool call |

```yaml
# In ~/.anakot/config.yaml
display:
  busy_input_mode: "steer"   # or "queue" or "interrupt"
```

## Slash Commands

Type `/` to see the autocomplete dropdown.

| Command | Description |
|---------|-------------|
| `/help` | Show command help |
| `/model` | Show or change the current model |
| `/tools` | List currently available tools |
| `/skills` | Browse and manage skills |
| `/status` | Show session info — model, tokens, duration |
| `/usage` | Show detailed token usage |
| `/new` or `/reset` | Start a fresh session |
| `/compress` | Manually compress conversation context |
| `/title <name>` | Name the current session |
| `/reasoning <level>` | Change reasoning effort |
| `/skin` | Show or switch the active CLI skin |
| `/personality <name>` | Set a personality |
| `/background <prompt>` | Run a prompt in a background session |
| `/update` | Update Anakot to the latest version |

> **Tip:** Commands are case-insensitive. Installed skills also become slash commands automatically.

## Personalities

Set a predefined personality to change the agent's tone:

```
/personality pirate
/personality kawaii
/personality concise
```

Built-in personalities include: `helpful`, `concise`, `technical`, `creative`, `teacher`, `kawaii`, `pirate`, `shakespeare`, `surfer`, `noir`, `uwu`, `philosopher`, `hype`.

Define custom personalities in `~/.anakot/config.yaml`:

```yaml
personalities:
  helpful: "You are a helpful, friendly AI assistant."
  kawaii: "You are a kawaii assistant! Use cute expressions..."
  pirate: "Arrr! Ye be talkin' to Captain Anakot..."
```

## Skin/Theme System

Skins are **pure data** — no code changes needed. Located in `anakot_cli/skin_engine.py`.

Built-in skins: `default` (gold/kawaii), `ares` (crimson/bronze), `mono` (grayscale), `slate` (cool blue).

User skins: `~/.anakot/skins/<name>.yaml`

| Element | Skin Key |
|---------|----------|
| Banner panel border | `colors.banner_border` |
| Spinner faces | `spinner.waiting_faces` / `spinner.thinking_faces` |
| Spinner verbs | `spinner.thinking_verbs` |
| Tool output prefix | `tool_prefix` |
| Agent name | `branding.agent_name` |

## Preloading Skills at Launch

```bash
anakot -s anakot-agent,github-auth
anakot chat -s github-pr-workflow -q "open a draft PR"
```

## Windows-Specific Notes

- **Newlines in chat**: Use `Ctrl+Enter` (not `Alt+Enter`) in git-bash/Windows Terminal
- **Config encoding**: Save `config.yaml` as UTF-8 without BOM
- **Paths**: Forward slashes work everywhere (`C:/Users/...`)
- **PTY mode**: Set `pty=true` for interactive CLI tools (Codex, Claude Code)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `IndentationError` on startup | Re-clone or re-sync the repo — source files may be corrupted |
| `anakot` not found | Add `.venv\Scripts` to Windows PATH |
| Tool not available | `anakot tools` → enable toolset → `/reset` |
| Model/provider issues | `anakot doctor` → check config → `anakot auth` |
| Changes not taking effect | `/reset` for tools/skills, restart for config changes |

## See Also

- **[[TUI Guide]]** — Modern terminal UI with Ink/React
- **[[Configuration]]** — Config file, providers, models, options
- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[Skills System]]** — Procedural memory the agent creates and reuses
