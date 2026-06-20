#Requires -Version 5.1
<#
.SYNOPSIS
    Anakot Agent - Cross-Platform Installer (PowerShell)
.DESCRIPTION
    Installs Anakot Agent (Backend + TUI) on Windows, macOS, or Linux.
    Auto-installs Python, Node.js, Git, and uv if missing.
.EXAMPLE
    .\install-anakot.ps1
    .\install-anakot.ps1 -SkipSetup
#>

param(
    [switch]$SkipSetup
)

$ErrorActionPreference = "Continue"
$RepoUrl = "https://github.com/Chensihakniroth/ANAKOT-AGENT.git"

# ═══════════════════════════════════════════════════════════════
#  COLORS
# ═══════════════════════════════════════════════════════════════

function Write-Banner {
    Write-Host ""
    Write-Host "        █████╗ ███╗   ██╗ █████╗ ██╗  ██╗ ██████╗ ████████╗" -ForegroundColor Cyan
    Write-Host "       ██╔══██╗████╗  ██║██╔══██╗██║ ██╔╝██╔═══██╗╚══██╔══╝" -ForegroundColor Cyan
    Write-Host "       ███████║██╔██╗ ██║███████║█████╔╝ ██║   ██║   ██║   " -ForegroundColor Cyan
    Write-Host "       ██╔══██║██║╚██╗██║██╔══██║██╔═██╗ ██║   ██║   ██║   " -ForegroundColor Cyan
    Write-Host "       ██║  ██║██║ ╚████║██║  ██║██║  ██╗╚██████╔╝   ██║   " -ForegroundColor Cyan
    Write-Host "       ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   " -ForegroundColor Cyan
    Write-Host ""
    Write-Host "             A G E N T   -   I n s t a l l e r" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "       Backend + TUI  |  No web, no desktop GUI" -ForegroundColor Gray
    Write-Host "       Auto-installs: Python, Node.js, Git, uv" -ForegroundColor Gray
    Write-Host ""
}

function Write-Step {
    param([int]$Num, [int]$Total, [string]$Message)
    Write-Host "   [$Num/$Total] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
    Write-Host ""
}

function Write-Ok {
    param([string]$Message)
    Write-Host "         OK " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Fail {
    param([string]$Message)
    Write-Host "         FAIL " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "         -> " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Separator {
    Write-Host ""
    Write-Host "    -----------------------------------------------------"
    Write-Host ""
}

function Get-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-VersionString {
    param([string]$Command, [string]$Argument = "--version")
    try {
        $output = & $Command $Argument 2>&1 | Select-Object -First 1
        if ($output -match '(\d+\.\d+\.?\d*)') {
            return $Matches[1]
        }
    } catch { }
    return $null
}

# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

Clear-Host
Write-Banner

# ── Step 1: Python ──────────────────────────────────────────────────────

Write-Step -Num 1 -Total 4 -Message "Checking Python 3.11+..."

$pythonCmd = $null
$pythonVer = $null

if (Get-CommandExists "python3") {
    $v = Get-VersionString "python3"
    if ($v) {
        $parts = $v -split '\.'
        if ([int]$parts[0] -ge 3 -and [int]$parts[1] -ge 11) {
            $pythonCmd = "python3"
            $pythonVer = $v
        }
    }
}

if (-not $pythonCmd -and (Get-CommandExists "python")) {
    $v = Get-VersionString "python"
    if ($v) {
        $parts = $v -split '\.'
        if ([int]$parts[0] -ge 3 -and [int]$parts[1] -ge 11) {
            $pythonCmd = "python"
            $pythonVer = $v
        }
    }
}

if (-not $pythonCmd -and (Get-CommandExists "py")) {
    $v = Get-VersionString "py" "-3 --version"
    if ($v) {
        $parts = $v -split '\.'
        if ([int]$parts[0] -ge 3 -and [int]$parts[1] -ge 11) {
            $pythonCmd = "py -3"
            $pythonVer = $v
        }
    }
}

if ($pythonCmd -and $pythonVer) {
    Write-Ok "Python $pythonVer found."
} else {
    Write-Info "Python not found. Installing..."

    $wingetOk = $false
    if (Get-CommandExists "winget") {
        Write-Info "Installing via winget (1-2 min)..."
        winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python311;$env:PATH"
            $pythonCmd = "python"
            $pythonVer = Get-VersionString "python"
            $wingetOk = $true
        }
    }

    if (-not $wingetOk) {
        Write-Info "Downloading Python 3.11..."
        $installer = "$env:TEMP\python-3.11.exe"
        try {
            Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $installer -UseBasicParsing
            Write-Info "Running installer..."
            Start-Process -FilePath $installer -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1" -Wait
            Remove-Item $installer -ErrorAction SilentlyContinue
            $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python311;$env:PATH"
            $pythonCmd = "python"
            $pythonVer = Get-VersionString "python"
        } catch {
            Write-Fail "Could not install Python. Install from https://www.python.org/downloads/"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    if ($pythonCmd -and $pythonVer) {
        Write-Ok "Python $pythonVer installed."
    } else {
        Write-Fail "Python install failed."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Step 2: Node.js ────────────────────────────────────────────────────

Write-Step -Num 2 -Total 4 -Message "Checking Node.js 20+..."

$nodeVer = $null
if (Get-CommandExists "node") {
    $nodeVer = Get-VersionString "node"
}

if ($nodeVer) {
    $parts = $nodeVer -split '\.'
    if ([int]$parts[0] -ge 20) {
        Write-Ok "Node.js $nodeVer found."
    } else {
        $nodeVer = $null
    }
}

if (-not $nodeVer) {
    Write-Info "Node.js not found. Installing Node.js 22 LTS..."

    $wingetOk = $false
    if (Get-CommandExists "winget") {
        Write-Info "Installing via winget (1-2 min)..."
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            $env:PATH = "$env:ProgramFiles\nodejs;$env:PATH"
            $nodeVer = Get-VersionString "node"
            $wingetOk = $true
        }
    }

    if (-not $wingetOk) {
        Write-Info "Downloading Node.js 22 LTS..."
        $installer = "$env:TEMP\node-v22-x64.msi"
        try {
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" -OutFile $installer -UseBasicParsing
            Write-Info "Running installer (follow the prompts)..."
            Start-Process msiexec -ArgumentList "/i `"$installer`" /passive /norestart" -Wait
            Remove-Item $installer -ErrorAction SilentlyContinue
            $env:PATH = "$env:ProgramFiles\nodejs;$env:PATH"
            $nodeVer = Get-VersionString "node"
        } catch {
            Write-Fail "Could not install Node.js. Install from https://nodejs.org/"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    if ($nodeVer) {
        Write-Ok "Node.js $nodeVer installed."
    } else {
        Write-Fail "Node.js install failed."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Step 3: Git ─────────────────────────────────────────────────────────

Write-Step -Num 3 -Total 4 -Message "Checking Git..."

$gitVer = $null
if (Get-CommandExists "git") {
    $gitVer = (git --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
}

if ($gitVer) {
    Write-Ok "Git $gitVer found."
} else {
    Write-Info "Git not found. Installing..."

    $wingetOk = $false
    if (Get-CommandExists "winget") {
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            $env:PATH = "$env:ProgramFiles\Git\cmd;$env:PATH"
            $gitVer = (git --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
            $wingetOk = $true
        }
    }

    if (-not $wingetOk) {
        Write-Info "Downloading Git..."
        $installer = "$env:TEMP\git-installer.exe"
        try {
            Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -OutFile $installer -UseBasicParsing
            Write-Info "Running installer..."
            Start-Process -FilePath $installer -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS" -Wait
            Remove-Item $installer -ErrorAction SilentlyContinue
            $env:PATH = "$env:ProgramFiles\Git\cmd;$env:PATH"
            $gitVer = (git --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
        } catch {
            Write-Fail "Could not install Git. Install from https://git-scm.com/"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    if ($gitVer) {
        Write-Ok "Git $gitVer installed."
    } else {
        Write-Fail "Git install failed."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Step 4: uv ──────────────────────────────────────────────────────────

Write-Step -Num 4 -Total 4 -Message "Checking uv (Python package manager)..."

$uvVer = $null
if (Get-CommandExists "uv") {
    $uvVer = (uv --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
}

if ($uvVer) {
    Write-Ok "uv $uvVer found."
} else {
    Write-Info "uv not found. Installing..."

    $wingetOk = $false
    if (Get-CommandExists "winget") {
        winget install astral-sh.uv --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            $env:PATH = "$env:USERPROFILE\.local\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
            $uvVer = (uv --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
            $wingetOk = $true
        }
    }

    if (-not $wingetOk) {
        Write-Info "Installing via official installer..."
        try {
            if ($env:OS -eq "Windows_NT") {
                powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
                $env:PATH = "$env:USERPROFILE\.local\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
            } else {
                curl -LsSf https://astral.sh/uv/install.sh | sh
                $env:PATH = "$env:HOME/.local/bin;$env:HOME/.cargo/bin;$env:PATH"
            }
            $uvVer = (uv --version 2>&1) -replace '.*?(\d+\.\d+\.?\d*).*', '$1'
        } catch {
            Write-Fail "Could not install uv. Install from https://docs.astral.sh/uv/"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    if ($uvVer) {
        Write-Ok "uv $uvVer installed."
    } else {
        Write-Fail "uv install failed."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Install Directory ──────────────────────────────────────────────────

Write-Separator
Write-Host "    Where do you want to install Anakot Agent?"
Write-Host ""
Write-Host "      [1]  $env:USERPROFILE\AnakotAgent  (recommended)"
Write-Host "      [2]  Custom folder"
Write-Host "      [3]  Current folder (portable)"
Write-Host ""

$choice = Read-Host "    Enter 1, 2, or 3 [1]"
if (-not $choice) { $choice = "1" }

switch ($choice) {
    "1" { $finalDir = "$env:USERPROFILE\AnakotAgent" }
    "2" {
        $customDir = Read-Host "    Enter full path"
        if (-not $customDir) {
            Write-Fail "No path entered."
            Read-Host "Press Enter to exit"
            exit 1
        }
        $finalDir = $customDir
    }
    "3" { $finalDir = "$PWD\AnakotAgent" }
    default { $finalDir = "$env:USERPROFILE\AnakotAgent" }
}

Write-Host ""
Write-Info "Install directory: $finalDir"
Write-Host ""

if (Test-Path $finalDir) {
    Write-Host "    WARNING: Directory already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "    Delete and reinstall? [y/N]"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "    Cancelled."
        Read-Host "Press Enter to exit"
        exit 0
    }
    Write-Info "Cleaning old install..."
    Remove-Item -Recurse -Force $finalDir -ErrorAction SilentlyContinue
    if (Test-Path $finalDir) {
        Write-Fail "Could not remove $finalDir"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Clone Repo ─────────────────────────────────────────────────────────

Write-Separator
Write-Host "    Cloning repository..."
Write-Host ""

$tempDir = "$env:TEMP\anakot-install-$(Get-Random)"
git clone --depth 1 --filter=blob:none --sparse $RepoUrl $tempDir
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Git clone failed. Check your internet connection."
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $tempDir
git sparse-checkout set --no-cone @(
    "anakot_cli/", "agent/", "cli.py", "run_agent.py",
    "model_tools.py", "toolsets.py", "toolset_distributions.py",
    "batch_runner.py", "trajectory_compressor.py",
    "anakot_bootstrap.py", "anakot_constants.py", "anakot_state.py",
    "anakot_time.py", "anakot_logging.py", "utils.py", "mcp_serve.py",
    "acp_adapter/", "acp_registry/", "cron/", "gateway/",
    "providers/", "tools/", "skills/", "optional-skills/",
    "plugins/", "locales/", "tui_gateway/", "ui-tui/",
    "pyproject.toml", "uv.lock", "setup.py", "MANIFEST.in",
    "LICENSE", "README.md", "cli-config.yaml.example",
    "constraints-termux.txt"
)

if (Test-Path $finalDir) { Remove-Item -Recurse -Force $finalDir }
Move-Item $tempDir $finalDir -ErrorAction SilentlyContinue
if (-not (Test-Path $finalDir) -and (Test-Path $tempDir)) {
    Copy-Item -Recurse $tempDir $finalDir
    Remove-Item -Recurse $tempDir
}
Set-Location $finalDir

Write-Ok "Repository cloned."

# ── Create Virtual Environment ─────────────────────────────────────────

Write-Separator
Write-Host "    Creating Python virtual environment..."
Write-Host ""

uv venv venv --python 3.11
if ($LASTEXITCODE -ne 0) {
    Write-Fail "venv creation failed."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "venv created."

# ── Install Python Dependencies ────────────────────────────────────────

Write-Separator
Write-Host "    Installing Python dependencies (2-5 minutes)..."
Write-Host ""

$env:UV_PROJECT_ENVIRONMENT = "$finalDir\venv"

if (Test-Path "uv.lock") {
    Write-Host "    -> Using uv.lock for verified install..."
    uv sync --extra all --locked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    -> Lockfile sync failed, trying without lock..."
        uv pip install -e ".[cron,cli,pty,mcp]"
    }
} else {
    uv pip install -e ".[cron,cli,pty,mcp]"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "    WARNING: Some optional deps failed. Core should still work." -ForegroundColor Yellow
}

Write-Ok "Dependencies installed."

# ── Build TUI ──────────────────────────────────────────────────────────

Write-Separator
Write-Host "    Building TUI frontend..."
Write-Host ""

Set-Location "$finalDir\ui-tui"

npm install --ignore-scripts --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
    Write-Host "    -> npm install had issues, retrying..."
    npm install --ignore-scripts --no-fund --no-audit
}

npm run build
$tuiBuilt = ($LASTEXITCODE -eq 0)

Set-Location $finalDir
Write-Host ""

if ($tuiBuilt) {
    Write-Ok "TUI built."
} else {
    Write-Host "    WARNING: TUI build failed. You can still use --cli mode." -ForegroundColor Yellow
}

# ── Setup Global Command ───────────────────────────────────────────────

Write-Separator
Write-Host "    Setting up global 'anakot' command..."
Write-Host ""

$binDir = "$env:USERPROFILE\.anakot\bin"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }

# Create batch wrapper for cmd.exe
$batchWrapper = @"
@echo off
set "ANAKOT_HOME=$env:USERPROFILE\.anakot"
set "PYTHONUTF8=1"
"$finalDir\venv\Scripts\python.exe" -m anakot_cli.main %*
"@
$batchWrapper | Set-Content -Path "$binDir\anakot.bat" -Encoding UTF8

# Create PowerShell wrapper
$psWrapper = @"
`$env:ANAKOT_HOME = "$env:USERPROFILE\.anakot"
`$env:PYTHONUTF8 = "1"
& "$finalDir\venv\Scripts\python.exe" -m anakot_cli.main `@args
"@
$psWrapper | Set-Content -Path "$binDir\anakot.ps1" -Encoding UTF8

# Add to User PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath) {
    $pathEntries = $currentPath -split ";"
    if ($pathEntries -notcontains $binDir) {
        [Environment]::SetEnvironmentVariable("Path", "$binDir;$currentPath", "User")
        $env:PATH = "$binDir;$env:PATH"
        Write-Ok "Added to PATH: $binDir"
    } else {
        Write-Ok "Already on PATH."
    }
} else {
    [Environment]::SetEnvironmentVariable("Path", $binDir, "User")
    $env:PATH = "$binDir;$env:PATH"
    Write-Ok "Added to PATH: $binDir"
}

# Set ANAKOT_HOME permanently
[Environment]::SetEnvironmentVariable("ANAKOT_HOME", "$env:USERPROFILE\.anakot", "User")

# Create data directories
@("skills", "sessions", "logs", "cron") | ForEach-Object {
    $dir = "$env:USERPROFILE\.anakot\$_"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

# Copy bundled skills
if (Test-Path "$finalDir\skills") {
    Copy-Item -Recurse "$finalDir\skills\*" "$env:USERPROFILE\.anakot\skills\" -Force -ErrorAction SilentlyContinue
    Write-Ok "Bundled skills installed."
}

# Copy config template
if (-not (Test-Path "$env:USERPROFILE\.anakot\config.yaml") -and (Test-Path "$finalDir\cli-config.yaml.example")) {
    Copy-Item "$finalDir\cli-config.yaml.example" "$env:USERPROFILE\.anakot\config.yaml"
}

Write-Host ""

# ── Verify ─────────────────────────────────────────────────────────────

Write-Separator
Write-Host "    Verifying installation..."
Write-Host ""

try {
    & "$finalDir\venv\Scripts\python.exe" -c "import anakot_cli.main; print('OK')" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Backend: Working"
    } else {
        Write-Host "    WARNING: Backend import test failed." -ForegroundColor Yellow
    }
} catch {
    Write-Host "    WARNING: Backend import test failed." -ForegroundColor Yellow
}

if (Test-Path "$finalDir\ui-tui\dist\entry.js") {
    Write-Ok "TUI: Built"
} else {
    Write-Host "    WARNING: TUI not built. Use --cli mode." -ForegroundColor Yellow
}

# ── Done ───────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ""
Write-Host "         ===================================================" -ForegroundColor Green
Write-Host "              I N S T A L L A T I O N   D O N E" -ForegroundColor Green
Write-Host "         ===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "              Install:  $finalDir"
Write-Host "              Data:     $env:USERPROFILE\.anakot"
Write-Host ""
Write-Host "         ----------------------------------------------------"
Write-Host "         NEXT STEPS:"
Write-Host ""
Write-Host "         1. RESTART your terminal"
Write-Host "         2. Run:  anakot setup"
Write-Host "         3. Run:  anakot --tui"
Write-Host "         ----------------------------------------------------"
Write-Host ""

if (-not $SkipSetup) {
    $runSetup = Read-Host "         Run setup wizard now? [Y/n]"
    if ($runSetup -ne "n" -and $runSetup -ne "N") {
        Write-Host ""
        Write-Info "Launching setup wizard..."
        Write-Host ""
        & "$finalDir\venv\Scripts\python.exe" -m anakot_cli.main setup
    }
}

Write-Host ""
Write-Host "         All done! Restart terminal, then: anakot --tui"
Write-Host ""
Read-Host "Press Enter to exit"
