# Anakot TUI — Windows 10 VM Setup Guide

## Quick Start

### Option A: PowerShell (Recommended)

1. Open **PowerShell** (as Administrator if possible)
2. Allow script execution (one-time):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
3. Run the setup script:
   ```powershell
   .\setup-tui-windows.ps1
   ```
4. **Restart your terminal** (to pick up new PATH + env vars)
5. Configure API keys:
   ```powershell
   anakot setup
   ```
6. Launch the TUI:
   ```powershell
   anakot --tui
   ```

### Option B: Batch File (Double-Click)

1. Copy `setup-tui-windows.bat` to the VM
2. Double-click it (or run from `cmd.exe`)
3. Restart terminal when done
4. Run `anakot --tui`

### Option C: Manual Steps

If the scripts don't work, follow these manual steps:

#### 1. Install Prerequisites

```powershell
# Python 3.11+
winget install Python.Python.3.11

# Node.js 20+ LTS
winget install OpenJS.NodeJS.LTS

# uv (Python package manager)
powershell -c "Invoke-Expression (Invoke-WebRequest -Uri 'https://astral.sh/uv/install.ps1' -UseBasicParsing).Content"
```

Restart terminal after installs.

#### 2. Clone the Repo

```powershell
git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git D:\School\PROJECT\anakot-agent
```

#### 3. Create Virtual Environment

```powershell
cd D:\School\PROJECT\anakot-agent
uv venv venv --python 3.11
```

#### 4. Install Python Dependencies

```powershell
$env:UV_PROJECT_ENVIRONMENT = "D:\School\PROJECT\anakot-agent\venv"
uv sync --extra all --locked
```

#### 5. Build the TUI Bundle

```powershell
cd ui-tui
npm install
npm run build
cd ..
```

Verify: `ui-tui\dist\entry.js` should exist.

#### 6. Set Environment Variables

```powershell
[System.Environment]::SetEnvironmentVariable("ANAKOT_TUI_DIR", "D:\School\PROJECT\anakot-agent\ui-tui", "User")
[System.Environment]::SetEnvironmentVariable("ANAKOT_HOME", "$env:USERPROFILE\.anakot", "User")
[System.Environment]::SetEnvironmentVariable("PYTHONUTF8", "1", "User")
```

#### 7. Add to PATH

Add these to your User PATH:
- `D:\School\PROJECT\anakot-agent\venv\Scripts`
- `%USERPROFILE%\.local\bin`

#### 8. Launch

```powershell
anakot --tui
```

## What the Script Does

| Step | What | Why |
|------|------|-----|
| Check Python 3.11+ | `python --version` | Required by anakot |
| Check Node.js 20+ | `node --version` | Required by TUI |
| Check/install uv | `uv --version` | Python package manager |
| Clone repo | `git clone` | Get the source code |
| Create venv | `uv venv` | Isolated Python env |
| Install deps | `uv sync` | All Python packages |
| npm install | `npm install` in `ui-tui/` | TUI Node dependencies |
| Build TUI | `npm run build` | Creates `dist/entry.js` |
| Set `ANAKOT_TUI_DIR` | Points at `ui-tui/` | **Critical**: Makes launcher use prebuilt bundle, skips runtime npm install |
| Set `ANAKOT_HOME` | Points at `~/.anakot` | Config + skills directory |
| Sync skills | Copy from repo | Bundled skills |

## Troubleshooting

### "node not found" after install
- Restart your terminal (PATH refresh)
- If still broken: `winget install OpenJS.NodeJS.LTS` then restart

### "npm install" fails in ui-tui/
- Make sure Node.js 20+ is installed: `node --version`
- Try deleting `ui-tui\node_modules` and re-running

### TUI shows "Installing TUI dependencies..." every launch
- `ANAKOT_TUI_DIR` is not set correctly
- Verify: `$env:ANAKOT_TUI_DIR` should point at the `ui-tui/` folder
- The launcher uses this env var to take the prebuilt-bundle fast path

### TUI crashes on start
- Make sure the bundle was built: check `ui-tui\dist\entry.js` exists
- Try rebuilding: `cd ui-tui && npm run build`
- Check Node version: need 20+

### "anakot" command not found
- Add `D:\School\PROJECT\anakot-agent\venv\Scripts` to PATH
- Or use full path: `D:\School\PROJECT\anakot-agent\venv\Scripts\anakot.exe`

### Unicode/garbled text in TUI
- Make sure `PYTHONUTF8=1` is set
- Windows Terminal handles this best (install from Microsoft Store)

## Key Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `ANAKOT_TUI_DIR` | `D:\...\ui-tui` | Prebuilt TUI bundle path (skips runtime npm install) |
| `ANAKOT_HOME` | `%USERPROFILE%\.anakot` | Config, skills, state |
| `PYTHONUTF8` | `1` | UTF-8 mode on Windows |

## Files Created

```
D:\School\PROJECT\anakot-agent\
├── venv\                    # Python virtual environment
├── ui-tui\
│   ├── node_modules\        # TUI Node dependencies
│   └── dist\
│       └── entry.js         # Prebuilt TUI bundle (self-contained)
└── setup-tui-windows.ps1    # This setup script

%USERPROFILE%\.anakot\
├── skills\                  # Bundled skills
├── config.yaml              # Created by `anakot setup`
└── .env                     # API keys (created by `anakot setup`)
```
