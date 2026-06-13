# Quickstart — Anakot Agent

> Get Anakot running in under 5 minutes.

## Prerequisites

- **Python 3.11–3.13** (3.14 not supported)
- **Git**
- **uv** (fast Python package manager)
- **Node.js** (optional, for TUI and web dashboard)

## Step 1 — Install uv

```powershell
# PowerShell:
irm https://astral.sh/uv/install.ps1 | iex

# Or git-bash:
curl -fsSL https://astral.sh/uv/install.sh | bash
```

## Step 2 — Clone the Repository

```bash
git clone https://github.com/callmemo/anakot-agent.git
cd anakot-agent
```

## Step 3 — Install Dependencies

```bash
uv sync
source .venv/bin/activate        # git-bash / Linux / macOS
# OR
.venv\Scripts\activate           # Windows PowerShell / cmd
```

## Step 4 — Configure API Keys

Create `~/.anakot/.env`:

```
OPENROUTER_API_KEY=your_key_here
# OR
ANTHROPIC_API_KEY=your_key_here
# OR
GOOGLE_API_KEY=your_key_here
```

## Step 5 — Run the Setup Wizard

```bash
anakot setup
```

This walks you through choosing a model, provider, terminal backend, and enabling tools.

## Step 6 — Start Chatting

```bash
# Interactive CLI (default)
anakot

# Single query (non-interactive)
anakot chat -q "What is the capital of France?"

# Modern TUI mode
anakot --tui

# Web dashboard
anakot dashboard
# Opens at http://localhost:9119
```

## What to Try First

```
# Ask about itself
> What are you?

# Ask it to do something
> List all Python files in this project

# Use a skill
> /plan design a REST API for a todo app

# Check status
> /status

# Switch model
> /model anthropic/claude-sonnet-4-20250514
```

## Key In-Session Commands

| Command | What it does |
|---------|-------------|
| `/new` or `/reset` | Start fresh session |
| `/model` | Switch model |
| `/tools` | Manage toolsets |
| `/skills` | Browse skills |
| `/status` | Session info |
| `/usage` | Token usage |
| `/help` | All commands |
| `/quit` | Exit |

## Next Steps

- **[[Setup Guide]]** — Full installation, PATH setup, Windows notes
- **[[CLI Guide]]** — Complete CLI reference, slash commands, keybindings
- **[[TUI Guide]]** — Modern terminal UI with Ink/React
- **[[Configuration]]** — Config file, providers, models, options
- **[[Tools & Toolsets]]** — 60+ built-in tools and how to configure them
- **[[Skills System]]** — Procedural memory the agent creates and reuses
- **[[Messaging Gateway]]** — Telegram, Discord, Slack, and 20+ platforms
- **[[Web Dashboard]]** — Browser-based control panel
- **[[Architecture]]** — How it works under the hood
