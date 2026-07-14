# ── Railway Deploy: Anakot Web UI + Backend ──────────────────────────────────
# Multi-stage build:
#   1. Build the WEB_VERSION (Vite/React) frontend (Node stage)
#   2. Install the Python backend (FastAPI), copy built frontend, run server
#
# Railway sets PORT env var automatically. Data persists at /data (volume).
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Frontend ────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app

# Copy root workspace manifest + lock (needed for npm workspace resolution)
COPY package.json package-lock.json ./

# Copy workspace package.json files for dependencies npm needs to resolve.
# Only WEB_VERSION + apps/shared are needed; other workspaces (apps/desktop,
# web, ui-tui) are not brought into the context so npm skips them silently.
COPY WEB_VERSION/package.json WEB_VERSION/
COPY apps/shared/package.json apps/shared/

# Install workspace node_modules (cached unless lock or package.jsons change)
RUN npm ci --ignore-scripts --prefer-offline --no-audit

# Copy full source for workspaces we build
COPY WEB_VERSION/ WEB_VERSION/
COPY apps/shared/ apps/shared/

# Build WEB_VERSION → outputs to ../anakot_cli/web_dist/ by vite config
RUN npm run build --workspace=WEB_VERSION

# ── Stage 2: Python Backend ──────────────────────────────────────────────────
FROM python:3.11-slim-bookworm

WORKDIR /app

# Minimal system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gcc \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast deterministic Python package installer)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency manifests first (cache layer)
COPY pyproject.toml uv.lock ./
RUN touch ./README.md  # pyproject.toml references it; placeholder for dep cache

# Install Python deps with extras needed for the web server + LLM providers.
# --no-install-project: install deps only, not the anakot package itself yet.
# web:    FastAPI + Uvicorn (the web server)
# anthropic: Anthropic/Claude provider
# (openai is a core dep — always installed)
RUN uv sync --frozen --no-install-project --extra web --extra anthropic

# Copy source tree (dockerignore keeps out node_modules, .git, etc.)
COPY . .

# Copy the WEB_VERSION build output from Stage 1 into the right place
COPY --from=frontend /app/anakot_cli/web_dist/ /app/anakot_cli/web_dist/

# Install the anakot package itself (non-editable, no extra deps)
RUN uv pip install --no-cache-dir --no-deps -e "."

# ── Runtime ──────────────────────────────────────────────────────────────────

# Create non-root user and lock down agent source code.
# The anakot runtime user can read/traverse but NEVER write to /app.
# Only /data (the Railway volume) is writable.
RUN adduser --disabled-password --gecos "" anakot && \
    chown -R root:root /app && \
    chmod -R 555 /app && \
    chmod -R 755 /app/.venv && \
    mkdir -p /data && \
    chmod 777 /data

# Railway mounts a volume at /data for persistence; anakot uses it for config,
# sessions, logs, and skills. Override ANAKOT_HOME env var for ephemeral mode.
ENV ANAKOT_HOME=/data
ENV ANAKOT_WEB_DIST=/app/anakot_cli/web_dist

EXPOSE ${PORT:-8080}

COPY railway/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user so the chmod 555 actually blocks writes.
# Root bypasses all filesystem permissions — running as root makes
# the read-only guard meaningless.
USER anakot

ENTRYPOINT ["/entrypoint.sh"]
