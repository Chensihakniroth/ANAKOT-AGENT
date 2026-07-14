#!/bin/sh
# ── Railway Entrypoint: Anakot Web UI Server ─────────────────────────────────
# Starts the FastAPI backend that serves the WEB_VERSION frontend + all API
# endpoints (sessions, config, LLM providers, WebSocket gateway).
#
# Environment:
#   PORT               — Railway-assigned port (default 8080)
#   ANAKOT_HOME        — Data directory (default /data, Railway volume)
#   OPENAI_API_KEY      — (optional) OpenAI-compatible provider key
#   ANTHROPIC_API_KEY   — (optional) Anthropic provider key
#   Any other provider key the user configures
# ──────────────────────────────────────────────────────────────────────────────

set -e

PORT="${PORT:-8080}"

# Activate the Python venv created by `uv sync` at build time
if [ -f /app/.venv/bin/activate ]; then
  . /app/.venv/bin/activate
fi

# Ensure the data directory exists
mkdir -p "$ANAKOT_HOME"

# ── Seed default config if this is a fresh deployment ─────────────────────────
CONFIG_FILE="${ANAKOT_HOME}/config.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "→ No existing config found at $CONFIG_FILE — seeding defaults."
  cat > "$CONFIG_FILE" << 'CONFIGEOF'
# Default Railway config — override via Settings UI or env vars.
# The web UI expects this bare minimum to render.
display:
  interface: web
  busy_input_mode: interrupt
  tui_status_indicator: kaomoji
  show_reasoning: false
  streaming: false
provider:
  default: openai
model:
  default: gpt-4o
CONFIGEOF
fi

# ── Seed .env from Railway environment variables ─────────────────────────────
# Railway provides API keys as env vars. The backend reads them from .env at
# startup — we bridge them here so the Settings UI sees them.
ENV_FILE="${ANAKOT_HOME}/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "→ Creating $ENV_FILE from environment."
  : > "$ENV_FILE"
fi

# Sync known provider keys from env → .env if present and not already set.
for VAR in \
  OPENAI_API_KEY \
  ANTHROPIC_API_KEY \
  OPENROUTER_API_KEY \
  GROQ_API_KEY \
  DEEPSEEK_API_KEY \
  GEMINI_API_KEY \
  MISTRAL_API_KEY \
  TOGETHER_API_KEY \
  AZURE_OPENAI_API_KEY \
; do
  VALUE="$(eval echo \"\$${VAR}\" 2>/dev/null || true)"
  if [ -n "$VALUE" ]; then
    if ! grep -q "^${VAR}=" "$ENV_FILE" 2>/dev/null; then
      echo "${VAR}=${VALUE}" >> "$ENV_FILE"
    fi
  fi
done

# ── Fix Railway volume ownership ────────────────────────────────────────────
# Railway mounts a persistent volume at /data that is root-owned from earlier
# deployments.  The bind mount overlays the Dockerfile layer, so chown/chmod
# in the Dockerfile is silently lost.  We fix ownership at runtime — AFTER
# seeding new config files — so both existing and freshly-created files are
# accessible to the anakot server process.
chown -R anakot:anakot "$ANAKOT_HOME"

# ── Start the server ─────────────────────────────────────────────────────────
# We call web_server's start_server() directly — same as `anakot dashboard`
# would. open_browser=False because Railway is headless.
# allow_public=True skips the auth gate (Railway provides its own HTTPS).
#
# The server process runs as the `anakot` user (via su) so that the
# chmod 555 on /app actually prevents the AI from modifying the repo.
# The entrypoint itself remains root to write to the Railway volume.
echo "→ Starting Anakot Web UI on 0.0.0.0:${PORT}"

# Write the server launcher to a temp file to avoid nested-quote hell
cat > /tmp/run_anakot_server.py << 'PYEOF'
from anakot_cli.main import _sync_bundled_skills_quietly
from anakot_cli.web_server import start_server
import os

_sync_bundled_skills_quietly()

start_server(
    host='0.0.0.0',
    port=int(os.environ.get('PORT', 8080)),
    open_browser=False,
    allow_public=True,
)
PYEOF

# Drop privileges: run as `anakot` so chmod 555 on /app is effective.
# -p preserves Railway env vars (PORT, API keys, etc.)
exec su -p -s /bin/sh anakot -c \
  ". /app/.venv/bin/activate && exec python /tmp/run_anakot_server.py"