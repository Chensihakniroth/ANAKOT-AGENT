#!/bin/bash
# ============================================================================
# Anakot Agent Installer — TUI Edition
# ============================================================================
# Installs the Anakot Agent with the TUI frontend (anakot --tui).
# No web dashboard, no desktop GUI, no Electron, no Playwright.
#
# Uses uv for fast Python provisioning on desktop/server,
# and Python's stdlib venv + pip on Termux.
#
# Usage:
#   Clone the repo and run scripts/install.sh from the repo root.
#   There is NO public install script URL — clone the repo and run this locally.
#
# Options:
#   --skip-setup       Skip interactive setup wizard
#   --no-venv          Don't create virtual environment
#   --no-skills        Start with a blank slate (no bundled skills)
#   --branch NAME      Git branch to install (default: tui-revamp-design)
#   --commit SHA       Pin checkout to a specific commit
#   --dir PATH         Installation directory
#   --anakot-home PATH Data directory (default: ~/.anakot)
#   --non-interactive  Skip stages that require user input
#   --verify-only      Verify an existing install, then exit
#   --reinstall        Force full reinstall (removes existing venv + TUI dist)
#   -h, --help         Show this help
#
# ============================================================================

set -e

# Guard against environment leakage
if [ -n "${PYTHONPATH:-}" ]; then
    echo "Warning: Ignoring inherited PYTHONPATH during install"
    unset PYTHONPATH
fi
if [ -n "${PYTHONHOME:-}" ]; then
    echo "Warning: Ignoring inherited PYTHONHOME during install"
    unset PYTHONHOME
fi

export UV_NO_CONFIG=1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
REPO_URL_SSH="git@github.com:Chensihakniroth/ANAKOT-AGENT.git"
REPO_URL_HTTPS="https://github.com/Chensihakniroth/ANAKOT-AGENT.git"
ANAKOT_HOME="${ANAKOT_HOME:-$HOME/.anakot}"
if [ -n "${ANAKOT_INSTALL_DIR:-}" ]; then
    INSTALL_DIR="$ANAKOT_INSTALL_DIR"
    INSTALL_DIR_EXPLICIT=true
else
    INSTALL_DIR=""
    INSTALL_DIR_EXPLICIT=false
fi
PYTHON_VERSION="3.11"
NODE_VERSION="22"
BRANCH="tui-revamp-design"
INSTALL_COMMIT=""
ROOT_FHS_LAYOUT=false
TUI_EXTRAS="cli,pty,cron,acp,mcp"

# Options
USE_VENV=true
RUN_SETUP=true
NO_SKILLS=false
NON_INTERACTIVE=false
VERIFY_ONLY=false
REINSTALL=false

if [ -t 0 ]; then
    IS_INTERACTIVE=true
else
    IS_INTERACTIVE=false
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-venv)         USE_VENV=false; shift ;;
        --skip-setup)      RUN_SETUP=false; shift ;;
        --no-skills)       NO_SKILLS=true; shift ;;
        --branch)          BRANCH="$2"; shift 2 ;;
        --commit)          INSTALL_COMMIT="$2"; shift 2 ;;
        --dir)             INSTALL_DIR="$2"; INSTALL_DIR_EXPLICIT=true; shift 2 ;;
        --anakot-home)     ANAKOT_HOME="$2"; shift 2 ;;
        --non-interactive) NON_INTERACTIVE=true; shift ;;
        --verify-only)     VERIFY_ONLY=true; shift ;;
        --reinstall)       REINSTALL=true; shift ;;
        -h|--help)
            sed -n '3,35p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Helpers
print_banner() {
    echo ""
    echo -e "${MAGENTA}${BOLD}"
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│          Anakot Agent Installer — TUI Edition           │"
    echo "├─────────────────────────────────────────────────────────┤"
    echo "│  An open source AI agent by callmemo.                   │"
    echo "└─────────────────────────────────────────────────────────┘"
    echo -e "${NC}"
}

log_info()  { echo -e "${CYAN}→${NC} $1"; }
log_ok()    { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

prompt_yes_no() {
    local question="$1" default="${2:-yes}" prompt_suffix answer
    case "$default" in
        [yY]*) prompt_suffix="[Y/n]" ;;
        *)     prompt_suffix="[y/N]" ;;
    esac
    if [ "$NON_INTERACTIVE" = true ]; then answer=""
    elif [ "$IS_INTERACTIVE" = true ]; then
        read -r -p "$question $prompt_suffix " answer || answer=""
    elif [ -r /dev/tty ] && [ -w /dev/tty ]; then
        printf "%s %s " "$question" "$prompt_suffix" > /dev/tty
        IFS= read -r answer < /dev/tty || answer=""
    else answer=""; fi
    answer="${answer#"${answer%%[![:space:]]*}"}"
    answer="${answer%"${answer##*[![:space:]]}"}"
    if [ -z "$answer" ]; then
        case "$default" in [yY]*) return 0 ;; *) return 1 ;; esac
    fi
    case "$answer" in [yY]*) return 0 ;; *) return 1 ;; esac
}

is_termux() {
    [ -n "${TERMUX_VERSION:-}" ] || [[ "${PREFIX:-}" == *"com.termux/files/usr"* ]]
}

MANIFEST_FILE="$ANAKOT_HOME/.install_manifest"

load_manifest() {
    MANIFEST_DIR=""; MANIFEST_BRANCH=""; MANIFEST_COMMIT=""; MANIFEST_TIMESTAMP=""
    [ -f "$MANIFEST_FILE" ] || return 0
    while IFS='=' read -r key val; do
        case "$key" in
            dir)      MANIFEST_DIR="$val" ;;
            branch)   MANIFEST_BRANCH="$val" ;;
            commit)   MANIFEST_COMMIT="$val" ;;
            timestamp) MANIFEST_TIMESTAMP="$val" ;;
        esac
    done < "$MANIFEST_FILE"
}

save_manifest() {
    mkdir -p "$ANAKOT_HOME"
    local commit_hash
    commit_hash="$(cd "$INSTALL_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")"
    cat > "$MANIFEST_FILE" <<EOF
dir=$INSTALL_DIR
branch=$BRANCH
commit=${INSTALL_COMMIT:-$commit_hash}
timestamp=$(date -u +%Y%m%d-%H%M%S)
EOF
}

detect_os() {
    case "$(uname -s)" in
        Linux*)
            if is_termux; then OS="android"; DISTRO="termux"
            else OS="linux"; [ -f /etc/os-release ] && . /etc/os-release && DISTRO="$ID" || DISTRO="unknown"; fi ;;
        Darwin*) OS="macos"; DISTRO="macos" ;;
        CYGWIN*|MINGW*|MSYS*) OS="windows"; DISTRO="windows"
            log_error "Windows detected. Please use the PowerShell installer:"
            log_info "  Clone the repo and run scripts\\install.ps1 from the repo root."
            exit 1 ;;
        *) OS="unknown"; DISTRO="unknown"; log_warn "Unknown operating system" ;;
    esac
    log_ok "Detected: $OS ($DISTRO)"
}

resolve_install_layout() {
    if [ "$INSTALL_DIR_EXPLICIT" = true ]; then
        log_info "Install directory: $INSTALL_DIR (explicit)"; return 0
    fi
    if is_termux; then INSTALL_DIR="$ANAKOT_HOME/anakot-agent"; return 0; fi
    if [ "$OS" = "linux" ] && [ "$(id -u)" -eq 0 ]; then
        if [ -d "$ANAKOT_HOME/anakot-agent/.git" ]; then
            INSTALL_DIR="$ANAKOT_HOME/anakot-agent"
            log_info "Existing install at $INSTALL_DIR — keeping legacy layout"; return 0
        fi
        INSTALL_DIR="/usr/local/lib/anakot-agent"; ROOT_FHS_LAYOUT=true
        export UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR:-/usr/local/share/uv/python}"
        export UV_PYTHON_BIN_DIR="${UV_PYTHON_BIN_DIR:-/usr/local/share/uv/bin}"
        log_info "Root install — FHS layout: $INSTALL_DIR"; return 0
    fi
    INSTALL_DIR="$ANAKOT_HOME/anakot-agent"
}

get_command_link_dir() {
    if is_termux && [ -n "${PREFIX:-}" ]; then echo "$PREFIX/bin"
    elif [ "$ROOT_FHS_LAYOUT" = true ]; then echo "/usr/local/bin"
    else echo "$HOME/.local/bin"; fi
}

install_uv() {
    if [ "$DISTRO" = "termux" ]; then UV_CMD=""; return 0; fi
    local managed_uv="$ANAKOT_HOME/bin/uv"
    if [ -x "$managed_uv" ]; then
        UV_CMD="$managed_uv"
        log_ok "Managed uv found ($($UV_CMD --version 2>/dev/null))"; return 0
    fi
    log_info "Installing managed uv into $ANAKOT_HOME/bin ..."
    mkdir -p "$ANAKOT_HOME/bin"
    local log_file installer; log_file="$(mktemp)"; installer="$(mktemp)"
    if ! curl -LsSf https://astral.sh/uv/install.sh -o "$installer" 2>"$log_file"; then
        log_error "Failed to download uv installer"; sed 's/^/    /' "$log_file" >&2
        rm -f "$log_file" "$installer"; exit 1
    fi
    if UV_UNMANAGED_INSTALL="$ANAKOT_HOME/bin" sh "$installer" >>"$log_file" 2>&1; then
        rm -f "$installer"
        if [ -x "$managed_uv" ]; then UV_CMD="$managed_uv"
            log_ok "Managed uv installed ($($UV_CMD --version 2>/dev/null))"
            rm -f "$log_file"; return 0
        fi
    fi
    log_error "uv installer failed"; sed 's/^/    /' "$log_file" >&2
    rm -f "$log_file" "$installer"; exit 1
}

check_python() {
    if [ "$DISTRO" = "termux" ]; then
        if command -v python >/dev/null 2>&1; then
            PYTHON_PATH="$(command -v python)"
            log_ok "Python found: $(python --version 2>/dev/null)"; return 0
        fi
        log_info "Installing Python via pkg..."; pkg install -y python >/dev/null
        PYTHON_PATH="$(command -v python)"
        log_ok "Python installed: $(python --version 2>/dev/null)"; return 0
    fi
    log_info "Checking Python $PYTHON_VERSION..."
    if PYTHON_PATH="$($UV_CMD python find "$PYTHON_VERSION" 2>/dev/null)"; then
        log_ok "Python found: $($PYTHON_PATH --version 2>/dev/null)"; return 0
    fi
    log_info "Python $PYTHON_VERSION not found, installing via uv..."
    if "$UV_CMD" python install "$PYTHON_VERSION"; then
        PYTHON_PATH="$($UV_CMD python find "$PYTHON_VERSION")"
        log_ok "Python installed: $($PYTHON_PATH --version 2>/dev/null)"
    else log_error "Failed to install Python $PYTHON_VERSION"; exit 1; fi
}

check_git() {
    log_info "Checking Git..."
    if command -v git &>/dev/null && git --version &>/dev/null; then
        log_ok "Git $(git --version | awk '{print $3}') found"; return 0
    fi
    if [ "$DISTRO" = "termux" ]; then pkg install -y git >/dev/null
        log_ok "Git $(git --version | awk '{print $3}') installed"; return 0; fi
    local sudo_cmd=""
    [ "$(id -u 2>/dev/null || echo 1000)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo_cmd="sudo"
    case "$OS" in
        macos)
            if command -v brew >/dev/null 2>&1; then brew install git >/dev/null 2>&1 || true
            elif command -v xcode-select >/dev/null 2>&1; then
                xcode-select --install >/dev/null 2>&1 || true
                local waited=0
                while [ "$waited" -lt 900 ]; do
                    command -v git >/dev/null 2>&1 && return 0
                    sleep 5; waited=$((waited + 5))
                done
            fi ;;
        linux)
            case "$DISTRO" in
                ubuntu|debian) $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true; $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git >/dev/null 2>&1 || true ;;
                fedora)  $sudo_cmd dnf install -y git >/dev/null 2>&1 || true ;;
                arch)    $sudo_cmd pacman -S --noconfirm git >/dev/null 2>&1 || true ;;
            esac ;;
    esac
    if command -v git &>/dev/null && git --version &>/dev/null; then
        log_ok "Git $(git --version | awk '{print $3}') installed"; return 0
    fi
    log_error "Git not found. Install it manually and re-run."; exit 1
}

node_satisfies_build() {
    local ver="${1#v}" major="${ver%%.*}" minor="${ver#*.}"; minor="${minor%%.*}"
    case "$major" in ''|*[!0-9]*) return 1 ;; esac
    case "$minor" in ''|*[!0-9]*) minor=0 ;; esac
    [ "$major" -eq 20 ] && [ "$minor" -ge 19 ] && return 0
    [ "$major" -ge 22 ] && { [ "$major" -gt 22 ] || [ "$minor" -ge 12 ]; } && return 0
    return 1
}

check_node() {
    log_info "Checking Node.js (for TUI build)..."
    if command -v node &>/dev/null && node_satisfies_build "$(node --version)"; then
        log_ok "Node.js $(node --version) found"; HAS_NODE=true; return 0
    fi
    if [ -x "$ANAKOT_HOME/node/bin/node" ] && node_satisfies_build "$("$ANAKOT_HOME/node/bin/node" --version)"; then
        export PATH="$ANAKOT_HOME/node/bin:$PATH"
        log_ok "Node.js $($ANAKOT_HOME/node/bin/node --version) found (Anakot-managed)"
        HAS_NODE=true; return 0
    fi
    if command -v node &>/dev/null; then
        log_warn "Node.js $(node --version) too old — installing Node $NODE_VERSION LTS..."
    else log_info "Node.js not found — installing Node $NODE_VERSION LTS..."; fi
    install_node
}

install_node() {
    if [ "$DISTRO" = "termux" ]; then
        pkg install -y nodejs >/dev/null
        log_ok "Node.js $(node --version 2>/dev/null) installed via pkg"
        HAS_NODE=true; return 0
    fi
    local arch=$(uname -m) node_arch node_os
    case "$arch" in
        x86_64) node_arch="x64" ;; aarch64|arm64) node_arch="arm64" ;;
        armv7l) node_arch="armv7l" ;;
        *) log_warn "Unsupported arch ($arch)"; HAS_NODE=false; return 0 ;;
    esac
    case "$OS" in
        linux) node_os="linux" ;; macos) node_os="darwin" ;;
        *) log_warn "Unsupported OS"; HAS_NODE=false; return 0 ;;
    esac
    local index_url="https://nodejs.org/dist/latest-v${NODE_VERSION}.x/"
    local tarball_name
    tarball_name=$(curl -fsSL "$index_url" | grep -oE "node-v${NODE_VERSION}\.[0-9]+\.[0-9]+-${node_os}-${node_arch}\.tar\.xz" | head -1)
    if [ -z "$tarball_name" ]; then
        tarball_name=$(curl -fsSL "$index_url" | grep -oE "node-v${NODE_VERSION}\.[0-9]+\.[0-9]+-${node_os}-${node_arch}\.tar\.gz" | head -1)
    fi
    if [ -z "$tarball_name" ]; then
        log_warn "Could not find Node.js $NODE_VERSION for $node_os-$node_arch"
        HAS_NODE=false; return 0
    fi
    local tmp_dir; tmp_dir=$(mktemp -d)
    log_info "Downloading $tarball_name..."
    if ! curl -fsSL "${index_url}${tarball_name}" -o "$tmp_dir/$tarball_name"; then
        log_warn "Download failed"; rm -rf "$tmp_dir"; HAS_NODE=false; return 0
    fi
    log_info "Extracting to ~/.anakot/node/..."
    [[ "$tarball_name" == *.tar.xz ]] && tar xf "$tmp_dir/$tarball_name" -C "$tmp_dir" || tar xzf "$tmp_dir/$tarball_name" -C "$tmp_dir"
    local extracted_dir; extracted_dir=$(ls -d "$tmp_dir"/node-v* 2>/dev/null | head -1)
    [ ! -d "$extracted_dir" ] && { log_warn "Extraction failed"; rm -rf "$tmp_dir"; HAS_NODE=false; return 0; }
    rm -rf "$ANAKOT_HOME/node"; mkdir -p "$ANAKOT_HOME"
    mv "$extracted_dir" "$ANAKOT_HOME/node"; rm -rf "$tmp_dir"
    local link_dir; link_dir="$(get_command_link_dir)"
    mkdir -p "$link_dir"
    ln -sf "$ANAKOT_HOME/node/bin/node" "$link_dir/node"
    ln -sf "$ANAKOT_HOME/node/bin/npm"  "$link_dir/npm"
    ln -sf "$ANAKOT_HOME/node/bin/npx"  "$link_dir/npx"
    export PATH="$ANAKOT_HOME/node/bin:$PATH"
    log_ok "Node.js $($ANAKOT_HOME/node/bin/node --version) installed"
    HAS_NODE=true
}

install_system_packages() {
    command -v rg &>/dev/null && { log_ok "$(rg --version | head -1) found"; return 0; }
    log_info "Installing ripgrep..."
    if [ "$DISTRO" = "termux" ]; then
        pkg install -y ripgrep >/dev/null 2>&1 && { log_ok "ripgrep installed"; return 0; }
    elif [ "$OS" = "macos" ] && command -v brew &>/dev/null; then
        brew install ripgrep >/dev/null 2>&1 && { log_ok "ripgrep installed"; return 0; }
    elif [ "$OS" = "linux" ]; then
        local sudo_cmd=""
        [ "$(id -u)" -ne 0 ] && command -v sudo &>/dev/null && sudo_cmd="sudo"
        case "$DISTRO" in
            ubuntu|debian)
                $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
                $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ripgrep >/dev/null 2>&1 && { log_ok "ripgrep installed"; return 0; } ;;
            fedora) $sudo_cmd dnf install -y ripgrep >/dev/null 2>&1 && { log_ok "ripgrep installed"; return 0; } ;;
            arch)   $sudo_cmd pacman -S --noconfirm ripgrep >/dev/null 2>&1 && { log_ok "ripgrep installed"; return 0; } ;;
        esac
    fi
    log_warn "ripgrep not installed — file search will use grep fallback"
}

check_network() {
    if ! command -v curl &>/dev/null; then log_warn "curl not found — skipping connectivity check"; return 0; fi
    if curl -fsSI --max-time 8 https://pypi.org/simple/ >/dev/null 2>&1; then log_ok "Internet connectivity OK"
    else log_warn "Could not reach pypi.org — install may fail if packages aren't cached"; fi
}

clone_repo() {
    log_info "Repository: $BRANCH"
    if [ "$REINSTALL" = true ] && [ -d "$INSTALL_DIR" ]; then
        log_warn "Reinstall mode — removing $INSTALL_DIR"; rm -rf "$INSTALL_DIR"; fi
    if [ -d "$INSTALL_DIR" ]; then
        if [ ! -d "$INSTALL_DIR/.git" ]; then
            log_error "Directory exists but is not a git repo: $INSTALL_DIR"
            log_info "Remove it or choose a different directory with --dir"; exit 1
        fi
        local current_branch; current_branch=$(cd "$INSTALL_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
        local autostash_ref=""
        if [ -n "$(cd "$INSTALL_DIR" && git status --porcelain)" ]; then
            local stash_name="anakot-install-autostash-$(date -u +%Y%m%d-%H%M%S)"
            log_info "Local changes detected — stashing..."
            (cd "$INSTALL_DIR" && git stash push --include-untracked -m "$stash_name")
            autostash_ref="stash@{0}"
        fi
        if [ "$current_branch" = "$BRANCH" ]; then log_info "Already on $BRANCH — pulling latest..."
        else log_info "Switching from $current_branch → $BRANCH..."; fi
        (cd "$INSTALL_DIR" && git fetch origin "$BRANCH" 2>/dev/null)
        (cd "$INSTALL_DIR" && git checkout "$BRANCH" 2>/dev/null)
        (cd "$INSTALL_DIR" && git pull --ff-only origin "$BRANCH" 2>/dev/null) || true
        if [ -n "$autostash_ref" ]; then
            if [ "$IS_INTERACTIVE" = true ]; then
                if prompt_yes_no "Restore local changes?" "yes"; then
                    (cd "$INSTALL_DIR" && git stash apply "$autostash_ref" 2>/dev/null && git stash drop "$autostash_ref" 2>/dev/null) || \
                        log_warn "Could not restore stashed changes — they're still in git stash"
                fi
            fi
        fi
        log_ok "Repository updated ($BRANCH)"
    else
        log_info "Cloning $BRANCH..."
        if GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=5" \
           git clone --depth 1 --branch "$BRANCH" "$REPO_URL_SSH" "$INSTALL_DIR" 2>/dev/null; then
            log_ok "Cloned via SSH"
        else
            rm -rf "$INSTALL_DIR" 2>/dev/null
            if git clone --depth 1 --branch "$BRANCH" "$REPO_URL_HTTPS" "$INSTALL_DIR"; then
                log_ok "Cloned via HTTPS"
            else log_error "Failed to clone repository"; exit 1; fi
        fi
    fi
    if [ -n "$INSTALL_COMMIT" ]; then
        log_info "Pinning to commit $INSTALL_COMMIT..."
        if ! (cd "$INSTALL_DIR" && git cat-file -e "$INSTALL_COMMIT^{commit}" 2>/dev/null); then
            (cd "$INSTALL_DIR" && git fetch origin "$INSTALL_COMMIT" 2>/dev/null) || true; fi
        (cd "$INSTALL_DIR" && git checkout --detach "$INSTALL_COMMIT")
    fi
    log_ok "Repository ready at $INSTALL_DIR"
}

setup_venv() {
    if [ "$USE_VENV" = false ]; then log_info "Skipping virtual environment (--no-venv)"; return 0; fi
    if [ "$DISTRO" = "termux" ]; then
        [ -d "venv" ] && { log_info "Recreating venv..."; rm -rf venv; }
        "$PYTHON_PATH" -m venv venv
        log_ok "Venv ready ($(./venv/bin/python --version 2>/dev/null))"; return 0
    fi
    if [ "$REINSTALL" = true ] && [ -d "$INSTALL_DIR/venv" ]; then
        log_warn "Reinstall mode — removing existing venv"; rm -rf "$INSTALL_DIR/venv"; fi
    if [ -d "$INSTALL_DIR/venv" ]; then log_info "Virtual environment already exists — reusing"
    else
        log_info "Creating venv (Python $PYTHON_VERSION)..."
        $UV_CMD venv "$INSTALL_DIR/venv" --python "$PYTHON_VERSION"
    fi
    [ -x "$INSTALL_DIR/venv/bin/python" ] && export UV_PYTHON="$INSTALL_DIR/venv/bin/python"
    log_ok "Venv ready (Python $PYTHON_VERSION)"
}

install_deps() {
    if [ "$DISTRO" != "termux" ] && [ -x "$INSTALL_DIR/venv/bin/python" ]; then
        export UV_PYTHON="$INSTALL_DIR/venv/bin/python"; fi
    if [ "$DISTRO" = "termux" ]; then
        local pip_python="$INSTALL_DIR/venv/bin/python"
        "$pip_python" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1
        "$pip_python" -m pip install -e ".[${TUI_EXTRAS}]" 2>&1 | tail -5
        log_ok "Python deps installed"; return 0
    fi
    export VIRTUAL_ENV="$INSTALL_DIR/venv"
    local spec=".[${TUI_EXTRAS}]"
    if [ -f "$INSTALL_DIR/uv.lock" ]; then
        log_info "Trying hash-verified install (uv.lock)..."
        if UV_PROJECT_ENVIRONMENT="$INSTALL_DIR/venv" $UV_CMD sync --extra all --locked 2>&1 | tail -3; then
            log_ok "Deps installed (hash-verified)"; return 0
        fi
        log_warn "uv.lock sync failed — falling back to PyPI resolve"
    fi
    log_info "Installing Python dependencies ($spec)..."
    if $UV_CMD pip install -e "$spec" 2>&1 | tail -5; then log_ok "Deps installed ($spec)"
    elif $UV_CMD pip install -e "." 2>&1 | tail -5; then log_warn "Installed core only — some TUI features may be missing"
    else log_error "Package installation failed"; log_info "Try: cd $INSTALL_DIR && uv pip install -e '$spec'"; exit 1; fi
}

build_tui() {
    if [ "$HAS_NODE" = false ]; then
        log_warn "Node.js not available — skipping TUI build"
        log_info "Install Node.js and run: cd $INSTALL_DIR/ui-tui && npm run build"; return 0
    fi
    [ ! -f "$INSTALL_DIR/ui-tui/package.json" ] && { log_warn "ui-tui not found in checkout — skipping TUI build"; return 0; }
    if [ -f "$INSTALL_DIR/ui-tui/dist/entry.js" ] && [ "$REINSTALL" = false ]; then
        local newer; newer=$(find "$INSTALL_DIR/ui-tui/src" -type f -newer "$INSTALL_DIR/ui-tui/dist/entry.js" 2>/dev/null | head -1)
        if [ -z "$newer" ]; then log_ok "TUI already built (dist/entry.js is up to date)"; return 0; fi
        log_info "TUI source changed — rebuilding..."
    else log_info "Building TUI..."; fi
    cd "$INSTALL_DIR/ui-tui"
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
        log_info "Installing TUI npm dependencies..."
        npm install --silent 2>/dev/null || npm install
    fi
    if npm run build 2>&1 | tail -5; then log_ok "TUI built successfully (dist/entry.js)"
    else log_error "TUI build failed"; log_info "Run manually: cd $INSTALL_DIR/ui-tui && npm run build"; exit 1; fi
}

setup_path() {
    log_info "Setting up anakot command..."
    local anakot_bin="$INSTALL_DIR/venv/bin/anakot"
    [ ! -x "$anakot_bin" ] && { log_warn "anakot entry point not found at $anakot_bin"; return 0; }
    local link_dir; link_dir="$(get_command_link_dir)"
    mkdir -p "$link_dir"; rm -f "$link_dir/anakot"
    cat > "$link_dir/anakot" <<EOF
#!/usr/bin/env bash
unset PYTHONPATH; unset PYTHONHOME
exec "$anakot_bin" "$@"
EOF
    chmod +x "$link_dir/anakot"
    log_ok "anakot → $link_dir/anakot"
    if [ "$OS" = "linux" ] && [ "$(id -u)" -eq 0 ]; then
        local profile_d="/etc/profile.d/anakot.sh"
        echo "export PATH=\"$link_dir:\$PATH\"" > "$profile_d"
        chmod 644 "$profile_d"; log_ok "Global PATH: $profile_d"
    elif [ "$OS" = "macos" ]; then
        local cur; cur="$(launchctl getenv PATH 2>/dev/null || echo "")"
        if [[ ":$cur:" != *":$link_dir:"* ]]; then
            launchctl setenv PATH "$link_dir:$cur" 2>/dev/null || true
            log_ok "Global PATH: launchctl setenv PATH (macOS)"; fi
        [ "$(id -u)" -eq 0 ] && { echo "$link_dir" > /etc/paths.d/anakot 2>/dev/null || true; log_ok "Global PATH: /etc/paths.d/anakot"; }
    fi
    if ! echo "$PATH" | tr ':' '\n' | grep -q "^${link_dir}$"; then
        local shell_configs=() shell_rc
        case "$(basename "${SHELL:-/bin/bash}")" in
            zsh)  shell_configs=("$HOME/.zshrc" "$HOME/.zprofile") ;;
            bash) shell_configs=("$HOME/.bashrc" "$HOME/.bash_profile") ;;
            fish)
                local fc="$HOME/.config/fish/config.fish"
                mkdir -p "$(dirname "$fc")"; touch "$fc"
                grep -q 'fish_add_path.*\.local/bin' "$fc" 2>/dev/null || {
                    echo "" >> "$fc"; echo "# Anakot Agent" >> "$fc"
                    echo 'fish_add_path "$HOME/.local/bin"' >> "$fc"
                    log_ok "Added ~/.local/bin to PATH in $fc"; }
                export PATH="$link_dir:$PATH"
                log_ok "anakot command ready (restart shell to use)"; return 0 ;;
            *)    shell_configs=("$HOME/.bashrc") ;;
        esac
        for shell_rc in "${shell_configs[@]}"; do
            [ -f "$shell_rc" ] || continue
            if ! grep -v '^[[:space:]]*#' "$shell_rc" 2>/dev/null | grep -qE 'PATH=.*\.local/bin'; then
                echo "" >> "$shell_rc"
                echo "# Anakot Agent — ensure ~/.local/bin is on PATH" >> "$shell_rc"
                echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$shell_rc"
                log_ok "Added ~/.local/bin to PATH in $shell_rc"
            fi
        done
    fi
    export PATH="$link_dir:$PATH"
    log_ok "anakot command ready"
}

copy_config_templates() {
    log_info "Setting up configuration..."
    mkdir -p "$ANAKOT_HOME"/{cron,sessions,logs,pairing,hooks,image_cache,audio_cache,memories,skills}
    if [ ! -f "$ANAKOT_HOME/.env" ]; then
        [ -f "$INSTALL_DIR/.env.example" ] && cp "$INSTALL_DIR/.env.example" "$ANAKOT_HOME/.env" || touch "$ANAKOT_HOME/.env"
        chmod 600 "$ANAKOT_HOME/.env"; log_ok "Created ~/.anakot/.env"
    else log_info "~/.anakot/.env already exists — keeping it"; fi
    if [ ! -f "$ANAKOT_HOME/config.yaml" ]; then
        [ -f "$INSTALL_DIR/cli-config.yaml.example" ] && { cp "$INSTALL_DIR/cli-config.yaml.example" "$ANAKOT_HOME/config.yaml"; log_ok "Created ~/.anakot/config.yaml from template"; }
    else log_info "~/.anakot/config.yaml already exists — keeping it"; fi
    if [ ! -f "$ANAKOT_HOME/SOUL.md" ]; then
        printf '%s\n' '# Anakot Agent Persona' '' '<!-- Edit this to customize how Anakot communicates with you. -->' > "$ANAKOT_HOME/SOUL.md"
        log_ok "Created ~/.anakot/SOUL.md"
    fi
    if [ "$NO_SKILLS" = true ]; then
        printf '%s\n' "Opted out of bundled skills (--no-skills)." "Delete this file to re-enable." > "$ANAKOT_HOME/.no-bundled-skills" 2>/dev/null || true
        log_info "Skipping bundled skills (--no-skills)"
    else
        log_info "Syncing bundled skills..."
        if "$INSTALL_DIR/venv/bin/python" "$INSTALL_DIR/tools/skills_sync.py" 2>/dev/null; then log_ok "Skills synced"
        elif [ -d "$INSTALL_DIR/skills" ]; then
            cp -r "$INSTALL_DIR/skills/"* "$ANAKOT_HOME/skills/" 2>/dev/null || true; log_ok "Skills copied"; fi
    fi
}

verify_install() {
    log_info "Verifying installation..."
    local ok=true
    local anakot_cmd; anakot_cmd="$(command -v anakot 2>/dev/null || echo "")"
    [ -n "$anakot_cmd" ] && log_ok "anakot command: $anakot_cmd" || { log_error "anakot command not found on PATH"; ok=false; }
    if "$INSTALL_DIR/venv/bin/python" -c "import anakot_cli" 2>/dev/null; then log_ok "Python core imports OK"
    else log_error "Cannot import anakot_cli — venv may be broken"; ok=false; fi
    if [ -f "$INSTALL_DIR/ui-tui/dist/entry.js" ]; then
        local sz; sz=$(du -h "$INSTALL_DIR/ui-tui/dist/entry.js" 2>/dev/null | cut -f1)
        log_ok "TUI dist: $INSTALL_DIR/ui-tui/dist/entry.js ($sz)"
    else log_warn "TUI dist not found — anakot --tui will not work"; fi
    [ -f "$ANAKOT_HOME/.env" ] && log_ok "Config: ~/.anakot/.env" || log_warn "Missing: ~/.anakot/.env"
    [ -f "$ANAKOT_HOME/config.yaml" ] && log_ok "Config: ~/.anakot/config.yaml" || log_warn "Missing: ~/.anakot/config.yaml"
    if [ -d "$INSTALL_DIR/.git" ]; then
        local ib ic; ib=$(cd "$INSTALL_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null); ic=$(cd "$INSTALL_DIR" && git rev-parse --short HEAD 2>/dev/null)
        log_ok "Git: $ib @ $ic"; fi
    $ok && { echo ""; log_ok "All checks passed"; } || { echo ""; log_warn "Some checks failed — see above"; }
    $ok
}

run_setup_wizard() {
    if [ "$RUN_SETUP" = false ]; then log_info "Skipping setup wizard (--skip-setup)"; return 0; fi
    if ! (: </dev/tty) 2>/dev/null; then log_info "Setup wizard skipped (no terminal). Run 'anakot setup' after install."; return 0; fi
    echo ""; log_info "Starting setup wizard..."; echo ""
    cd "$INSTALL_DIR"
    if [ "$USE_VENV" = true ]; then "$INSTALL_DIR/venv/bin/python" -m anakot_cli.main setup < /dev/tty
    else python -m anakot_cli.main setup < /dev/tty; fi
}

print_success() {
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│              Installation Complete!                     │"
    echo "└─────────────────────────────────────────────────────────┘"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}  Your files:${NC}"
    echo ""
    echo -e "    ${YELLOW}Config:${NC}    $ANAKOT_HOME/config.yaml"
    echo -e "    ${YELLOW}API Keys:${NC}  $ANAKOT_HOME/.env"
    echo -e "    ${YELLOW}Data:${NC}      $ANAKOT_HOME/{cron,sessions,logs,skills}/"
    echo -e "    ${YELLOW}Code:${NC}      $INSTALL_DIR"
    echo ""
    echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}  Commands:${NC}"
    echo ""
    echo -e "    ${GREEN}anakot${NC}              Start interactive TUI"
    echo -e "    ${GREEN}anakot --tui${NC}        Start TUI explicitly"
    echo -e "    ${GREEN}anakot setup${NC}        Configure API keys & settings"
    echo -e "    ${GREEN}anakot config edit${NC}  Open config in editor"
    echo -e "    ${GREEN}anakot update${NC}       Update to latest version"
    echo ""
    if [ "$DISTRO" = "termux" ]; then
        echo -e "${YELLOW}  'anakot' is on PATH in Termux — ready to use.${NC}"
    elif [ "$ROOT_FHS_LAYOUT" = true ]; then
        echo -e "${YELLOW}  'anakot' is in /usr/local/bin — ready to use.${NC}"
    else
        echo -e "${YELLOW}  Reload your shell to use 'anakot':${NC}"
        local ls; ls="$(basename "${SHELL:-/bin/bash}")"
        case "$ls" in
            zsh)  echo "   source ~/.zshrc" ;;
            bash) echo "   source ~/.bashrc" ;;
            fish) echo "   source ~/.config/fish/config.fish" ;;
            *)    echo "   source ~/.bashrc" ;; esac
    fi
    echo ""
}

main() {
    print_banner
    detect_os
    resolve_install_layout
    load_manifest
    [ -n "$MANIFEST_DIR" ] && [ "$MANIFEST_DIR" = "$INSTALL_DIR" ] && [ "$MANIFEST_BRANCH" = "$BRANCH" ] && \
        log_info "Existing install detected (manifest: $MANIFEST_BRANCH @ ${MANIFEST_TIMESTAMP:-unknown})"
    install_uv
    check_python
    check_git
    check_node
    check_network
    install_system_packages
    clone_repo
    save_manifest
    setup_venv
    install_deps
    build_tui
    setup_path
    copy_config_templates
    verify_install
    run_setup_wizard
    print_success
}

if [ "$VERIFY_ONLY" = true ]; then
    detect_os; resolve_install_layout; load_manifest; verify_install
else
    main
fi
