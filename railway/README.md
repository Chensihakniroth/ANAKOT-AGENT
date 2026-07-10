# 🚂 Railway Deployment — Anakot Web UI

Deploy the Anakot Web UI (the `WEB_VERSION` frontend + FastAPI Python backend) to Railway.

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/Chensihakniroth/ANAKOT-AGENT&dockerfile=railway/Dockerfile)

Or manually:

1. **Push this repo to GitHub**
2. **Create a new Railway service** from your GitHub repo
3. **Set Root Directory** to `/` (repo root)
4. **Railway detects `railway/Dockerfile`** automatically via `railway.json`
5. **Add environment variables**:
   - `PORT` — Railway sets this automatically
   - `OPENAI_API_KEY` — your OpenAI API key (or any other provider)
   - `ANTHROPIC_API_KEY` — (optional) for Anthropic models
   - Any other provider keys you want to use
6. **Add a volume** at `/data` for persistent config/sessions/logs

## How It Works

```
┌─ Frontend (Node) ─────────────────┐
│ WEB_VERSION/    npm run build     │
│  ↓                               │
│ anakot_cli/web_dist/  (static)   │
└──────────────────────────────────┘
┌─ Backend (Python) ─────────────────┐
│ anakot_cli/web_server.py           │
│ FastAPI + Uvicorn                  │
│  • Serves static frontend          │
│  • REST API (sessions, config, …)  │
│  • WebSocket Gateway (chat, PTY)   │
│  • LLM provider proxy              │
└────────────────────────────────────┘
```

## Architecture

- **Frontend**: Vite+React app built during Docker build (`npm run build --workspace=WEB_VERSION`)
- **Backend**: FastAPI server (`anakot dashboard` equivalent) on port `$PORT`
- **Data**: Persistent at `/data` (ANAKOT_HOME) — config.yaml, .env, state.db, logs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes (or another provider) | OpenAI-compatible API key |
| `ANTHROPIC_API_KEY` | No | Anthropic Claude API key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key |
| `GROQ_API_KEY` | No | Groq API key |
| Any provider env var | As needed | Auto-synced to .env on first start |

## Railway Setup Steps (Detailed)

### 1. Connect GitHub Repo

- Go to [Railway Dashboard](https://railway.app/dashboard)
- Click **New Project** → **Deploy from GitHub repo**
- Select `Chensihakniroth/ANAKOT-AGENT`
- Railway picks up `railway/Dockerfile` automatically

### 2. Configure the Service

- **Root Directory**: Keep as `/` (project root)
- **Build Command**: (Handled by Dockerfile — leave blank)
- **Start Command**: (Handled by entrypoint.sh — leave blank)

### 3. Add Environment Variables

In your Railway service → **Variables** tab, add:
- `OPENAI_API_KEY` = `sk-...` (required for LLM access)
- Any other provider keys you need

`PORT` is set automatically by Railway — don't override it.

### 4. Add Persistent Volume

Railway services have ephemeral storage. For persistent data:
1. Go to your service → **Settings** → **Volumes**
2. Add a volume mounted at `/data` (default `ANAKOT_HOME`)
3. This persists config, sessions, API keys, and logs across restarts

Without a volume, you'll lose sessions and config on every deploy.

### 5. Deploy & Access

Railway builds and deploys the service. Once healthy:
- Your URL will be `https://<project>.up.railway.app`
- Open it in a browser — you'll see the Anakot Web UI
- Go to **Settings** → **Providers** to configure your LLM provider
- Start a new chat session

## Local Build Test

```bash
# Test the Docker build locally
docker build -f railway/Dockerfile -t anakot-web .
docker run -p 8080:8080 -e PORT=8080 -e OPENAI_API_KEY=sk-... anakot-web
```

Visit http://localhost:8080

## Notes

- The backend uses `allow_public=True` (no auth gate) because Railway provides HTTPS + the user controls access via Railway's own authentication.
- For production use, always attach a volume at `/data` to preserve session history.
- The `healthcheckPath` is `/api/status` — Railway uses this to check if the service is alive.
