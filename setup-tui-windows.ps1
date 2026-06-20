# ============================================================================
# Anakot TUI Setup Script for Windows 10
# ============================================================================
# Run this in PowerShell (as Administrator recommended):
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   .\setup-tui.ps1
#
# What this does:
# 1. Checks/installs Python 3.11+, Node.js 20+, and uv
# 2. Clones or copies the anakot-agent repo
# 3. Creates a Python venv and installs dependencies
# 4. Prebuilds the TUI bundle (ui-tui/dist/entry.js)
# 5. Sets ANAKOT_TUI_DIR so the launcher uses the prebuilt bundle
# 6. Creates a convenient "anakot-tui.bat" launcher
# ============================================================================

param(
    [string]$RepoPath = "D:\School\PROJECT\anakot-agent",
    [string]$AnakotHome = "$env:USERPROFILE\.anakot",
    [switch]$SkipPythonCheck,
    [switch]$SkipNodeCheck,
    [switch]$SkipUvCheck,
    [switch]$SkipClone
)

$ErrorActionPreference = "Stop"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Cyan = "`e[36m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Status($msg) { Write-Host "${Cyan}→${Reset} $msg" }
function Write-Ok($msg)     { Write-Host "${Green}✓${Reset} $msg" }
function Write-Warn($msg)   { Write-Host "${Yellow}⚠${Reset} $msg" }
function Write-Fail($msg)   { Write-Host "${Red}✗${Reset} $msg" }

# ============================================================================
# Step 0: Elevation check (warn but don't require)
# ============================================================================
Write-Host ""
Write-Host "${Cyan} Anakot TUI Setup (Windows 10)${Reset}"
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Running without admin rights. System-wide installs may fail."
    Write-Warn "If installs fail, re-run as Administrator."
    Write-Host ""
}

# ============================================================================
# Step 1: Python 3.11+
# ============================================================================
if (-not $SkipPythonCheck) {
    Write-Status "Checking Python 3.11+..."
    $pythonCmd = $null
    foreach ($cmd in @("python3", "python", "py")) {
        try {
            $verStr = & $cmd --version 2>&1
            if ($verStr -match "Python (\d+)\.(\d+)") {
                $major = [int]$Matches[1]
                $minor = [int]$Matches[2]
                if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 11)) {
                    $pythonCmd = $cmd
                    Write-Ok "Python $major.$minor found ($cmd)"
                    break
                }
            }
        } catch { }
    }

    if (-not $pythonCmd) {
        Write-Fail "Python 3.11+ not found."
        Write-Host ""
        Write-Host "Install options:"
        Write-Host "  winget install Python.Python.3.11"
        Write-Host "  https://www.python.org/downloads/"
        Write-Host ""
        Write-Host "After installing, restart PowerShell and re-run this script."
        exit 1
    }
}

# ============================================================================
# Step 2: Node.js 20+
# ============================================================================
if (-not $SkipNodeCheck) {
    Write-Status "Checking Node.js 20+..."
    try {
        $nodeVer = & node --version 2>&1
        if ($nodeVer -match "v(\d+)") {
            $nodeMajor = [int]$Matches[1]
            if ($nodeMajor -ge 20) {
                Write-Ok "Node.js $nodeVer found"
            } else {
                Write-Fail "Node.js $nodeVer is too old (need 20+)"
                Write-Host "Update via: winget install OpenJS.NodeJS.LTS"
                exit 1
            }
        }
    } catch {
        Write-Fail "Node.js not found."
        Write-Host ""
        Write-Host "Install options:"
        Write-Host "  winget install OpenJS.NodeJS.LTS"
        Write-Host "  https://nodejs.org/"
        Write-Host ""
        Write-Host "After installing, restart PowerShell and re-run this script."
        exit 1
    }
}

# ============================================================================
# Step 3: uv
# ============================================================================
if (-not $SkipUvCheck) {
    Write-Status "Checking uv..."
    try {
        $uvVer = & uv --version 2>&1
        Write-Ok "uv found ($uvVer)"
    } catch {
        Write-Status "Installing uv..."
        # Official installer
        Invoke-Expression (Invoke-WebRequest -Uri "https://astral.sh/uv/install.ps1" -UseBasicParsing).Content
        # Refresh PATH for this session
        $env:PATH = "$env:USERPROFILE\.local\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
        try {
            $uvVer = & uv --version 2>&1
            Write-Ok "uv installed ($uvVer)"
        } catch {
            Write-Fail "uv install failed. Install manually: https://docs.astral.sh/uv/"
            exit 1
        }
    }
}

# ============================================================================
# Step 4: Repo
# ============================================================================
if (-not $SkipClone) {
    if (Test-Path $RepoPath) {
        Write-Ok "Repo found at $RepoPath"
    } else {
        Write-Status "Cloning anakot-agent repo..."
        $parent = Split-Path $RepoPath -Parent
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        & git clone https://github.com/Chensihakniroth/ANAKOT-AGENT.git $RepoPath
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "git clone failed."
            Write-Host "Clone manually and re-run with -SkipClone"
            exit 1
        }
        Write-Ok "Repo cloned to $RepoPath"
    }
}

# Verify key files exist
$uiTuiDir = Join-Path $RepoPath "ui-tui"
if (-not (Test-Path (Join-Path $uiTuiDir "package.json"))) {
    Write-Fail "ui-tui/package.json not found. Is the repo path correct?"
    Write-Host "Expected: $uiTuiDir"
    exit 1
}

# ============================================================================
# Step 5: Python virtual environment
# ============================================================================
Write-Status "Setting up Python virtual environment..."

$venvPath = Join-Path $RepoPath "venv"
if (Test-Path $venvPath) {
    Write-Status "Removing old venv..."
    Remove-Item -Recurse -Force $venvPath
}

& uv venv $venvPath --python 3.11
Write-Ok "venv created (Python 3.11)"

$venvPython = Join-Path $venvPath "Scripts\python.exe"
$venvAnakot = Join-Path $venvPath "Scripts\anakot.exe"

# ============================================================================
# Step 6: Python dependencies
# ============================================================================
Write-Status "Installing Python dependencies (this may take a few minutes)..."

$uvLock = Join-Path $RepoPath "uv.lock"
if (Test-Path $uvLock) {
    Write-Status "Using uv.lock for hash-verified install..."
    $env:UV_PROJECT_ENVIRONMENT = $venvPath
    & uv sync --extra all --locked 2>&1 | ForEach-Object { Write-Host "  $_" }
} else {
    & uv pip install -e "$RepoPath[all]" 2>&1 | ForEach-Object { Write-Host "  $_" }
}

if ($LASTEXITCODE -ne 0) {
    Write-Warn "Full install failed, trying base install..."
    & uv pip install -e "$RepoPath" 2>&1 | ForEach-Object { Write-Host "  $_" }
}

Write-Ok "Python dependencies installed"

# ============================================================================
# Step 7: TUI npm install + build
# ============================================================================
Write-Status "Installing TUI Node dependencies..."

Push-Location $uiTuiDir
try {
    & npm install --silent --no-fund --no-audit 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed in ui-tui/"
        exit 1
    }
    Write-Ok "TUI dependencies installed"

    Write-Status "Building TUI bundle (dist/entry.js)..."
    & npm run build 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "TUI build failed"
        exit 1
    }

    $distEntry = Join-Path $uiTuiDir "dist\entry.js"
    if (Test-Path $distEntry) {
        Write-Ok "TUI bundle built: dist/entry.js"
    } else {
        Write-Fail "Build reported success but dist/entry.js not found"
        exit 1
    }
} finally {
    Pop-Location
}

# ============================================================================
# Step 8: Environment variables (persistent)
# ============================================================================
Write-Status "Configuring environment variables..."

# ANAKOT_TUI_DIR — points at the prebuilt TUI so launcher skips runtime npm install
[System.Environment]::SetEnvironmentVariable("ANAKOT_TUI_DIR", $uiTuiDir, "User")
Write-Ok "Set ANAKOT_TUI_DIR=$uiTuiDir (User)"

# ANAKOT_HOME
[System.Environment]::SetEnvironmentVariable("ANAKOT_HOME", $AnakotHome, "User")
Write-Ok "Set ANAKOT_HOME=$AnakotHome (User)"

# PYTHONUTF8 for Windows
[System.Environment]::SetEnvironmentVariable("PYTHONUTF8", "1", "User")
Write-Ok "Set PYTHONUTF8=1 (User)"

# Ensure ~/.anakot exists
if (-not (Test-Path $AnakotHome)) {
    New-Item -ItemType Directory -Path $AnakotHome -Force | Out-Null
}

# ============================================================================
# Step 9: Add to PATH
# ============================================================================
Write-Status "Checking PATH..."

$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$binDir = Join-Path $venvPath "Scripts"
$localBin = "$env:USERPROFILE\.local\bin"

$pathEntries = @($binDir, $localBin)
foreach ($entry in $pathEntries) {
    if ($currentPath -notlike "*$entry*") {
        [System.Environment]::SetEnvironmentVariable("Path", "$entry;$currentPath", "User")
        Write-Ok "Added to PATH: $entry"
    } else {
        Write-Ok "Already on PATH: $entry"
    }
}

# ============================================================================
# Step 10: Create launcher batch file
# ============================================================================
$launcherDir = Join-Path $AnakotHome "bin"
if (-not (Test-Path $launcherDir)) {
    New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null
}

$launcherBat = Join-Path $launcherDir "anakot-tui.bat"
@"
@echo off
REM Anakot TUI Launcher
REM Prebuilt bundle mode — no runtime npm install needed
set ANAKOT_TUI_DIR=$uiTuiDir
set ANAKOT_HOME=$AnakotHome
set PYTHONUTF8=1
$venvAnakot --tui %*
"@ | Set-Content -Path $launcherBat -Encoding ASCII

Write-Ok "Created launcher: $launcherBat"

# Also create a PowerShell launcher for better terminal handling
$launcherPs1 = Join-Path $launcherDir "anakot-tui.ps1"
@"
# Anakot TUI Launcher (PowerShell)
`$env:ANAKOT_TUI_DIR = "$uiTuiDir"
`$env:ANAKOT_HOME = "$AnakotHome"
`$env:PYTHONUTF8 = "1"
& "$venvAnakot" --tui `@args
"@ | Set-Content -Path $launcherPs1 -Encoding UTF8

Write-Ok "Created launcher: $launcherPs1"

# ============================================================================
# Step 11: Seed bundled skills
# ============================================================================
Write-Status "Syncing bundled skills to $AnakotHome/skills/..."
$skillsDir = Join-Path $AnakotHome "skills"
if (-not (Test-Path $skillsDir)) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
}

$skillsSrc = Join-Path $RepoPath "skills"
if (Test-Path $skillsSrc) {
    # Copy skills that don't already exist (don't overwrite user customizations)
    Get-ChildItem $skillsSrc -Directory | ForEach-Object {
        $dest = Join-Path $skillsDir $_.Name
        if (-not (Test-Path $dest)) {
            Copy-Item $_.FullName $dest -Recurse
        }
    }
    Write-Ok "Skills synced"
} else {
    Write-Warn "No bundled skills directory found in repo"
}

# ============================================================================
# Done
# ============================================================================
Write-Host ""
Write-Host "${Green}✓ Setup complete!${Reset}"
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "  1. Restart your terminal (to pick up new PATH + env vars)"
Write-Host ""
Write-Host "  2. Configure API keys:"
Write-Host "     $venvAnakot setup"
Write-Host ""
Write-Host "  3. Launch the TUI:"
Write-Host "     $launcherBat"
Write-Host "     (or: $venvAnakot --tui)"
Write-Host ""
Write-Host "Other commands:"
Write-Host "  anakot status        # Check configuration"
Write-Host "  anakot doctor        # Diagnose issues"
Write-Host "  anakot --cli         # Classic REPL mode"
Write-Host ""
Write-Host "To re-run the TUI later, just use:"
Write-Host "  & '$launcherPs1'"
Write-Host ""
