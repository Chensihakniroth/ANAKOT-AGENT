#!/usr/bin/env bash
#
#  Anakot Agent - Cross-Platform Installer (Bash)
#  Works on: macOS, Linux, Git Bash (Windows), WSL
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/Chensihakniroth/ANAKOT-AGENT/main/install-anakot.sh | bash
#    or
#    ./install-anakot.sh
#    ./install-anakot.sh --dir /opt/anakot
#    ./install-anakot.sh --skip-setup
#

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════

REPO_URL="https://github.com/Chensihakniroth/ANAKOT-AGENT.git"
MIN_PYTHON="3.11"
MIN_NODE="20"
INSTALL_DIR=""
SKIP_SETUP=false

# ═══════════════════════════════════════════════════════════════
#  COLORS
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

banner() {
    echo ""
    echo -e "${CYAN}        █████╗ ███╗   ██╗ █████╗ ██╗  ██╗ ██████╗ ████████╗${NC}"
    echo -e "${CYAN}       ██╔══██╗████╗  ██║██╔══██╗██║ ██╔╝██╔═══██╗╚══██╔══╝${NC}"
    echo -e "${CYAN}       ███████║██╔██╗ ██║███████║█████╔╝ ██║   ██║   ██║   ${NC}"
    echo -e "${CYAN}       ██╔══██║██║╚██╗██║██╔══██║██╔═██╗ ██║   ██║   ██║   ${NC}"
    echo -e "${CYAN}       ██║  ██║██║ ╚████║██║  ██║██║  ██╗╚██████╔╝   ██║   ${NC}"
    echo -e "${CYAN}       ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ${NC}"
    echo ""
    echo -e "             ${YELLOW}A G E N T   -   I n s t a l l e r${NC}"
    echo ""
    echo "       Backend + TUI  |  No web, no desktop GUI"
    echo "       Auto-installs: Python, Node.js, Git, uv"
    echo ""
}

step() {
    echo -e "   ${YELLOW}[$1/$2]${NC} $3"
    echo ""
}

ok() {
    echo -e "         ${GREEN}✔${NC} $1"
}

fail() {
    echo -e "         ${RED}✘${NC} $1"
}

info() {
    echo -e "         ${CYAN}→${NC} $1"
}

separator() {
    echo ""
    echo "    ─────────────────────────────────────────────────────"
    echo ""
}

detect_os() {
    case "$(uname -s)" in
        Darwin*)  echo "macos" ;;
        Linux*)   echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

command_exists() {
    command -v "$1" &>/dev/null
}

get_version() {
    local ver
    ver=$("$@" 2>&1 | grep -oP '\d+\.\d+\.?\d*' | head -1)
    echo "$ver"
}

version_gte() {
    # Returns 0 if $1 >= $2
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# ═══════════════════════════════════════════════════════════════
#  PARSE ARGS
# ═══════════════════════════════════════════════════════════════

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./install-anakot.sh [--dir PATH] [--skip-setup]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

OS=$(detect_os)

# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

clear 2>/dev/null || true
banner

# ── Step 1: Python ──────────────────────────────────────────────────────

step 1 4 "Checking Python ${MIN_PYTHON}+..."

PYTHON_CMD=""
PYTHON_VER=""

if command_exists python3; then
    PYTHON_VER=$(get_version python3 --version)
    if version_gte "$PYTHON_VER" "$MIN_PYTHON"; then
        PYTHON_CMD="python3"
    fi
fi

if [[ -z "$PYTHON_CMD" ]] && command_exists python; then
    PYTHON_VER=$(get_version python --version)
    if version_gte "$PYTHON_VER" "$MIN_PYTHON"; then
        PYTHON_CMD="python"
    fi
fi

if [[ -n "$PYTHON_CMD" ]]; then
    ok "Python $PYTHON_VER found."
else
    info "Python not found. Installing..."

    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            info "Installing via brew..."
            brew install python@3.11
            PYTHON_CMD="python3"
            PYTHON_VER=$(get_version python3 --version)
        else
            fail "Homebrew not found. Install from https://brew.sh/"
            exit 1
        fi

    elif [[ "$OS" == "linux" ]]; then
        if command_exists apt; then
            info "Installing via apt..."
            sudo apt update -qq
            sudo apt install -y -qq python3.11 python3.11-venv python3-pip
            PYTHON_CMD="python3"
            PYTHON_VER=$(get_version python3 --version)
        elif command_exists dnf; then
            info "Installing via dnf..."
            sudo dnf install -y python3.11
            PYTHON_CMD="python3"
            PYTHON_VER=$(get_version python3 --version)
        elif command_exists pacman; then
            info "Installing via pacman..."
            sudo pacman -S --noconfirm python
            PYTHON_CMD="python3"
            PYTHON_VER=$(get_version python3 --version)
        else
            fail "No supported package manager found. Install Python manually: https://www.python.org/downloads/"
            exit 1
        fi

    elif [[ "$OS" == "windows" ]]; then
        # Git Bash on Windows
        if command_exists winget; then
            info "Installing via winget..."
            winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements
            export PATH="$LOCALAPPDATA/Programs/Python/Python311:$PATH"
            PYTHON_CMD="python"
            PYTHON_VER=$(get_version python --version)
        else
            info "Downloading Python 3.11..."
            curl -fsSL "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -o "$TEMP/python-3.11.exe"
            info "Running installer..."
            "$TEMP/python-3.11.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1
            rm -f "$TEMP/python-3.11.exe"
            export PATH="$LOCALAPPDATA/Programs/Python/Python311:$PATH"
            PYTHON_CMD="python"
            PYTHON_VER=$(get_version python --version)
        fi
    else
        fail "Unsupported OS. Install Python manually: https://www.python.org/downloads/"
        exit 1
    fi

    if [[ -n "$PYTHON_CMD" ]]; then
        ok "Python $PYTHON_VER installed."
    else
        fail "Python install failed."
        exit 1
    fi
fi

# ── Step 2: Node.js ────────────────────────────────────────────────────

step 2 4 "Checking Node.js ${MIN_NODE}+..."

NODE_VER=""
if command_exists node; then
    NODE_VER=$(get_version node --version)
fi

if [[ -n "$NODE_VER" ]] && version_gte "$NODE_VER" "$MIN_NODE"; then
    ok "Node.js $NODE_VER found."
else
    info "Node.js not found. Installing Node.js 22 LTS..."

    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install node@22
            NODE_VER=$(get_version node --version)
        else
            fail "Homebrew not found."
            exit 1
        fi

    elif [[ "$OS" == "linux" ]]; then
        if command_exists apt; then
            info "Setting up NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            sudo apt install -y nodejs
            NODE_VER=$(get_version node --version)
        elif command_exists dnf; then
            sudo dnf install -y nodejs
            NODE_VER=$(get_version node --version)
        elif command_exists pacman; then
            sudo pacman -S --noconfirm nodejs npm
            NODE_VER=$(get_version node --version)
        else
            fail "No supported package manager. Install Node.js manually: https://nodejs.org/"
            exit 1
        fi

    elif [[ "$OS" == "windows" ]]; then
        if command_exists winget; then
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            export PATH="$ProgramFiles/nodejs:$PATH"
            NODE_VER=$(get_version node --version)
        else
            info "Downloading Node.js 22 LTS..."
            curl -fsSL "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" -o "$TEMP/node-v22-x64.msi"
            info "Running installer..."
            msiexec /i "$TEMP/node-v22-x64.msi" /passive /norestart
            rm -f "$TEMP/node-v22-x64.msi"
            export PATH="$ProgramFiles/nodejs:$PATH"
            NODE_VER=$(get_version node --version)
        fi
    fi

    if [[ -n "$NODE_VER" ]] && version_gte "$NODE_VER" "$MIN_NODE"; then
        ok "Node.js $NODE_VER installed."
    else
        fail "Node.js install failed. Install from https://nodejs.org/"
        exit 1
    fi
fi

# ── Step 3: Git ─────────────────────────────────────────────────────────

step 3 4 "Checking Git..."

GIT_VER=""
if command_exists git; then
    GIT_VER=$(get_version git --version)
fi

if [[ -n "$GIT_VER" ]]; then
    ok "Git $GIT_VER found."
else
    info "Git not found. Installing..."

    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install git
        else
            xcode-select --install
        fi

    elif [[ "$OS" == "linux" ]]; then
        if command_exists apt; then
            sudo apt install -y git
        elif command_exists dnf; then
            sudo dnf install -y git
        elif command_exists pacman; then
            sudo pacman -S --noconfirm git
        fi

    elif [[ "$OS" == "windows" ]]; then
        if command_exists winget; then
            winget install Git.Git --accept-package-agreements --accept-source-agreements
            export PATH="$ProgramFiles/Git/cmd:$PATH"
        else
            info "Downloading Git..."
            curl -fsSL "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -o "$TEMP/git-installer.exe"
            "$TEMP/git-installer.exe" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS
            rm -f "$TEMP/git-installer.exe"
            export PATH="$ProgramFiles/Git/cmd:$PATH"
        fi
    fi

    GIT_VER=$(get_version git --version)
    if [[ -n "$GIT_VER" ]]; then
        ok "Git $GIT_VER installed."
    else
        fail "Git install failed. Install from https://git-scm.com/"
        exit 1
    fi
fi

# ── Step 4: uv ──────────────────────────────────────────────────────────

step 4 4 "Checking uv (Python package manager)..."

UV_VER=""
if command_exists uv; then
    UV_VER=$(get_version uv --version)
fi

if [[ -n "$UV_VER" ]]; then
    ok "uv $UV_VER found."
else
    info "uv not found. Installing..."

    if [[ "$OS" == "windows" ]] && command_exists winget; then
        winget install astral-sh.uv --accept-package-agreements --accept-source-agreements
        export PATH="$USERPROFILE/.local/bin:$USERPROFILE/.cargo/bin:$PATH"
        UV_VER=$(get_version uv --version)
    fi

    if [[ -z "$UV_VER" ]]; then
        # Platform-agnostic installer
        if [[ "$OS" == "windows" ]]; then
            powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
            export PATH="$USERPROFILE/.local/bin:$USERPROFILE/.cargo/bin:$PATH"
        else
            curl -LsSf https://astral.sh/uv/install.sh | sh
            export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        fi
        UV_VER=$(get_version uv --version)
    fi

    if [[ -n "$UV_VER" ]]; then
        ok "uv $UV_VER installed."
    else
        fail "uv install failed. Install from https://docs.astral.sh/uv/"
        exit 1
    fi
fi

# ── Install Directory ──────────────────────────────────────────────────

separator

if [[ -z "$INSTALL_DIR" ]]; then
    echo "    Where do you want to install Anakot Agent?"
    echo ""
    echo "      [1]  $HOME/AnakotAgent  (recommended)"
    echo "      [2]  Custom folder"
    echo "      [3]  Current folder (portable)"
    echo ""
    read -rp "    Enter 1, 2, or 3 [1]: " choice
    choice=${choice:-1}

    case "$choice" in
        1) INSTALL_DIR="$HOME/AnakotAgent" ;;
        2)
            read -rp "    Enter full path: " custom_dir
            if [[ -z "$custom_dir" ]]; then
                fail "No path entered."
                exit 1
            fi
            INSTALL_DIR="$custom_dir"
            ;;
        3) INSTALL_DIR="$PWD/AnakotAgent" ;;
        *) INSTALL_DIR="$HOME/AnakotAgent" ;;
    esac
fi

echo ""
info "Install directory: $INSTALL_DIR"
echo ""

if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "    ${YELLOW}⚠ Directory already exists!${NC}"
    read -rp "    Delete and reinstall? [y/N]: " overwrite
    if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
        echo "    Cancelled."
        exit 0
    fi
    info "Cleaning old install..."
    rm -rf "$INSTALL_DIR"
fi

# ── Clone Repo ─────────────────────────────────────────────────────────

separator
echo "    Cloning repository..."
echo ""

TEMP_DIR=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$TEMP_DIR"

cd "$TEMP_DIR"
git sparse-checkout set --no-cone \
    anakot_cli/ \
    agent/ \
    cli.py \
    run_agent.py \
    model_tools.py \
    toolsets.py \
    toolset_distributions.py \
    batch_runner.py \
    trajectory_compressor.py \
    anakot_bootstrap.py \
    anakot_constants.py \
    anakot_state.py \
    anakot_time.py \
    anakot_logging.py \
    utils.py \
    mcp_serve.py \
    acp_adapter/ \
    acp_registry/ \
    cron/ \
    gateway/ \
    providers/ \
    tools/ \
    skills/ \
    optional-skills/ \
    plugins/ \
    locales/ \
    tui_gateway/ \
    ui-tui/ \
    pyproject.toml \
    uv.lock \
    setup.py \
    MANIFEST.in \
    LICENSE \
    README.md \
    cli-config.yaml.example \
    constraints-termux.txt

# Move to final destination
mkdir -p "$(dirname "$INSTALL_DIR")"
mv "$TEMP_DIR" "$INSTALL_DIR" 2>/dev/null || {
    cp -r "$TEMP_DIR" "$INSTALL_DIR"
    rm -rf "$TEMP_DIR"
}
cd "$INSTALL_DIR"

ok "Repository cloned."

# ── Create Virtual Environment ─────────────────────────────────────────

separator
echo "    Creating Python virtual environment..."
echo ""

uv venv venv --python 3.11
ok "venv created."

# ── Install Python Dependencies ────────────────────────────────────────

separator
echo "    Installing Python dependencies (2-5 minutes)..."
echo ""

export UV_PROJECT_ENVIRONMENT="$INSTALL_DIR/venv"

if [[ -f "uv.lock" ]]; then
    info "Using uv.lock for verified install..."
    uv sync --extra all --locked || {
        info "Lockfile sync failed, trying without lock..."
        uv pip install -e ".[cron,cli,pty,mcp]"
    }
else
    uv pip install -e ".[cron,cli,pty,mcp]"
fi

ok "Dependencies installed."

# ── Build TUI ──────────────────────────────────────────────────────────

separator
echo "    Building TUI frontend..."
echo ""

cd "$INSTALL_DIR/ui-tui"

npm install --ignore-scripts --no-fund --no-audit || {
    info "npm install had issues, retrying..."
    npm install --ignore-scripts --no-fund --no-audit
}

npm run build || {
    echo -e "    ${YELLOW}⚠ TUI build failed. You can still use --cli mode.${NC}"
}

cd "$INSTALL_DIR"
echo ""

if [[ -f "$INSTALL_DIR/ui-tui/dist/entry.js" ]]; then
    ok "TUI built."
else
    echo -e "    ${YELLOW}⚠ TUI: Not built. Use --cli mode.${NC}"
fi

# ── Setup Global Command ───────────────────────────────────────────────

separator
echo "    Setting up global 'anakot' command..."
echo ""

ANAKOT_HOME="${ANAKOT_HOME:-$HOME/.anakot}"
BIN_DIR="$ANAKOT_HOME/bin"
mkdir -p "$BIN_DIR"

# Create shell wrapper
cat > "$BIN_DIR/anakot" << WRAPPER
#!/bin/bash
export ANAKOT_HOME="$ANAKOT_HOME"
export PYTHONUTF8=1
"$INSTALL_DIR/venv/bin/python" -m anakot_cli.main "\$@"
WRAPPER
chmod +x "$BIN_DIR/anakot"

# Add to PATH in shell config
SHELL_RC=""
if [[ -f "$HOME/.bashrc" ]]; then
    SHELL_RC="$HOME/.bashrc"
elif [[ -f "$HOME/.zshrc" ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

if [[ -n "$SHELL_RC" ]]; then
    if ! grep -q "$BIN_DIR" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Anakot Agent" >> "$SHELL_RC"
        echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$SHELL_RC"
        ok "Added to PATH in $SHELL_RC"
    else
        ok "Already on PATH."
    fi
else
    echo "    Add this to your shell config:"
    echo "    export PATH=\"$BIN_DIR:\$PATH\""
fi

# Create data directories
mkdir -p "$ANAKOT_HOME"/{skills,sessions,logs,cron}

# Copy bundled skills
if [[ -d "$INSTALL_DIR/skills" ]]; then
    cp -r "$INSTALL_DIR/skills/"* "$ANAKOT_HOME/skills/" 2>/dev/null || true
    ok "Bundled skills installed."
fi

# Copy config template
if [[ ! -f "$ANAKOT_HOME/config.yaml" ]] && [[ -f "$INSTALL_DIR/cli-config.yaml.example" ]]; then
    cp "$INSTALL_DIR/cli-config.yaml.example" "$ANAKOT_HOME/config.yaml"
fi

echo ""

# ── Verify ─────────────────────────────────────────────────────────────

separator
echo "    Verifying installation..."
echo ""

if "$INSTALL_DIR/venv/bin/python" -c "import anakot_cli.main" 2>/dev/null; then
    ok "Backend: Working"
else
    echo -e "    ${YELLOW}⚠ Backend: Import test failed.${NC}"
fi

if [[ -f "$INSTALL_DIR/ui-tui/dist/entry.js" ]]; then
    ok "TUI: Built"
else
    echo -e "    ${YELLOW}⚠ TUI: Not built. Use --cli mode.${NC}"
fi

# ── Done ───────────────────────────────────────────────────────────────

echo ""
echo ""
echo -e "         ${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "         ${GREEN}║         I N S T A L L A T I O N   D O N E       ║${NC}"
echo -e "         ${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "              Install:  $INSTALL_DIR"
echo "              Data:     $ANAKOT_HOME"
echo ""
echo "         ┌─────────────────────────────────────────────┐"
echo "         │  NEXT STEPS:                                │"
echo "         │                                             │"
echo "         │  1. RESTART your terminal (or run: source)  │"
echo "         │  2. Run:  anakot setup                      │"
echo "         │  3. Run:  anakot --tui                      │"
echo "         └─────────────────────────────────────────────┘"
echo ""

if [[ "$SKIP_SETUP" == "false" ]]; then
    read -rp "         Run setup wizard now? [Y/n]: " run_setup
    if [[ "$run_setup" != "n" && "$run_setup" != "N" ]]; then
        echo ""
        info "Launching setup wizard..."
        echo ""
        "$INSTALL_DIR/venv/bin/python" -m anakot_cli.main setup
    fi
fi

echo ""
echo "         All done! Restart terminal, then: anakot --tui"
echo ""
