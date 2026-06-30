---
sidebar_position: 2
title: "Installation"
description: "Install Anakot Agent on Linux, macOS, WSL2, native Windows, or Android via Termux"
---

# Installation

Get Anakot Agent up and running in under two minutes!

## Quick Install

### Option 1: Clone from GitHub (Recommended)

```bash
git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git
cd ANAKOT-AGENT
```

Then follow the platform-specific setup:

#### Linux / macOS / WSL2

```bash
# Install Python 3.11+ if not present, then:
python -m venv venv
source venv/bin/activate
pip install -e .
pip install -r requirements.txt

# For desktop app:
cd apps/desktop
npm install
npm run dev
```

#### Windows (PowerShell)

```powershell
# Install Python 3.11+ if not present, then:
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
pip install -r requirements.txt

# For desktop app:
cd apps/desktop
npm install
npm run dev
```

#### Android (Termux)

```bash
pkg install python nodejs git
git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git
cd ANAKOT-AGENT
python -m venv venv
source venv/bin/activate
pip install -e .
pip install -r requirements.txt
```

### Option 2: Download a Release (Desktop App)

1. Go to [GitHub Releases](https://github.com/Chensihakniroth/ANAKOT-AGENT/releases)
2. Download the latest release for your platform:
   - Windows: `Anakot-Setup-x.x.x.exe`
   - macOS: `Anakot-Setup-x.x.x.dmg`
   - Linux: `Anakot-Setup-x.x.x.AppImage`
3. Run the installer / app

---

## Prerequisites

| Dependency | Version | Required For | Install |
|---|---|---|---|
| **Python** | 3.11+ | Core agent | [python.org](https://python.org) |
| **Node.js** | v22+ | Desktop app, browser automation | [nodejs.org](https://nodejs.org) or `nvm` |
| **Git** | any | Installation, updates | `apt/brew install git` |
| **uv** | any | Fast Python package management | `pip install uv` (optional) |
| **ripgrep** | any | Fast file search | `apt/brew install ripgrep` (optional) |
| **ffmpeg** | any | Audio format conversion for TTS | `apt/brew install ffmpeg` (optional) |

:::info
You do **not** need Node.js if you only want the CLI agent. Install Python 3.11+ and Git, then clone and run.
:::

---

## After Installation

### CLI Agent

```bash
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows
anakot                     # Start chatting!
```

### Desktop App

```bash
cd apps/desktop
npm run dev
```

To reconfigure individual settings later, use the dedicated commands:

```bash
anakot model          # Choose your LLM provider and model
anakot tools          # Configure which tools are enabled
anakot gateway setup  # Set up messaging platforms
anakot config set     # Set individual config values
anakot setup          # Or run the full setup wizard to configure everything at once
```

---

## Updates

### Source Install (git clone)
```bash
cd ANAKOT-AGENT
git pull origin main
pip install -e .        # Reinstall if dependencies changed
```

### Packaged Install (Desktop App)
The desktop app checks GitHub for updates every 30 minutes. When a new version is available:
- The version indicator in the bottom-right shows `v{x.x.x} (+{N})`
- Click it to open the Update dialog
- Click **Download from GitHub** to get the latest release

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `anakot: command not found` | Run `source venv/bin/activate` or check PATH |
| `API key not set` | Run `anakot model` to configure your provider |
| `ModuleNotFoundError` | Run `pip install -e .` from the project root |
| Desktop app won't start | Run `npm install && npm run build` in `apps/desktop/` |
| Missing config after update | Run `anakot config check` then `anakot config migrate` |

For more diagnostics, run `anakot doctor` — it will tell you exactly what's missing and how to fix it.
