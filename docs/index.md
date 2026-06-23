# Anakot Agent

> The self-improving AI agent built by **callmemo**. A built-in learning loop that creates skills from experience, improves them during use, nudges itself to persist knowledge, and builds a deepening model of who you are across sessions.

<div style="display:flex;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
<a href="getting-started/quickstart">Get Started →</a>
<a href="https://github.com/callmemo/anakot-agent">View on GitHub</a>
</div>

## What is Anakot Agent?

It's not a coding copilot tethered to an IDE or a chatbot wrapper around a single API. It's an **autonomous agent** that gets more capable the longer it runs. It lives wherever you put it — a local terminal, a VPS, or cloud infrastructure. Talk to it from Telegram while it works on a VM you never SSH into yourself.

**Anakot** (អនាគត in Khmer) means "future".

| | |
|---|---|
| 🚀 **[[Quickstart]]** | Get running in under 5 minutes |
| 📖 **[[CLI Guide]]** | Full CLI reference, slash commands, keybindings |
| 🖥️ **[[TUI Guide]]** | Modern terminal UI with Ink/React |
| 🌐 **[[Web Dashboard]]** | Browser-based control panel (embedded TUI chat) |
| ⚙️ **[[Configuration]]** | Config file, providers, models, and options |
| 🔧 **[[Tools & Toolsets]]** | 60+ built-in tools and how to configure them |
| 🧠 **[[Skills System]]** | Procedural memory the agent creates and reuses |
| 💬 **[[Messaging Gateway]]** | Telegram, Discord, Slack, WhatsApp, and 20+ platforms |
| 🧠 **[[Persistent Memory]]** | Memory that grows across sessions |
| 📄 **[[Context Files]]** | Project context files that shape every conversation |
| 🎭 **[[Personalities]]** | Define the agent's voice and tone |
| 🔒 **[[Security]]** | Command approval, authorization, container isolation |
| 🏗️ **[[Architecture]]** | How it works under the hood |
| ❓ **[[FAQ]]** | Common questions and solutions |

## Key Features

- **A closed learning loop** — Agent-curated memory with periodic nudges, autonomous skill creation, skill self-improvement during use, FTS5 cross-session recall, and Honcho dialectic user modeling
- **Runs anywhere, not just your laptop** — 6 terminal backends: local, Docker, SSH, Daytona, Singularity, Modal
- **Lives where you do** — CLI, Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS, DingTalk, Feishu, WeCom, Weixin, QQ Bot, Yuanbao, and more
- **Modern TUI** — Ink/React-based terminal UI with JSON-RPC wire protocol, mouse support, and streaming output
- **Web Dashboard** — FastAPI + React control panel at port 9119 with embedded real TUI (PTY + xterm.js)
- **Skin/Theme system** — Pure-data theming for both CLI and dashboard
- **Scheduled automations** — Built-in cron with delivery to any platform
- **Delegates & parallelizes** — Spawn isolated subagents for parallel workstreams
- **Open standard skills** — Compatible with agentskills.io
- **Full web control** — Search, extract, browse, vision, image generation, TTS

## Install

### Linux / macOS / WSL2

```bash
git clone https://github.com/callmemo/anakot-agent.git
cd anakot-agent
uv sync
source .venv/bin/activate
anakot setup
```

### Windows (native)

```powershell
# PowerShell — install uv
irm https://astral.sh/uv/install.ps1 | iex

# Clone and install
git clone https://github.com/callmemo/anakot-agent.git
cd anakot-agent
uv sync
.venv\Scripts\activate
anakot setup
```

Then:

```bash
anakot                    # Interactive CLI
anakot --tui              # Modern TUI
anakot dashboard          # Web dashboard
```

---

_Built by **callmemo** · MIT License · 2026_
_Anakot is a fork of [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) by Nous Research_
