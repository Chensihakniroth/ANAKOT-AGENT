# Configuration — Anakot Agent

> All settings are stored in the `~/.anakot/` directory for easy access.

## Directory Structure

```
~/.anakot/
├── config.yaml        # Settings (model, terminal, TTS, compression, etc.)
├── .env               # API keys and secrets
├── SOUL.md            # Agent identity/personality
├── memories/          # Persistent memory (MEMORY.md, USER.md)
├── skills/            # Installed skills
├── cron/              # Scheduled jobs
├── profiles/          # Per-profile isolated config
│   └── <name>/        # Each has own skills/, plugins/, cron/, memories/
├── skins/             # User-defined CLI skins (*.yaml)
├── dashboard-themes/  # User-defined dashboard themes (*.yaml)
├── logs/              # Logs (agent.log, errors.log, gateway.log)
└── state.db           # Session store (SQLite + FTS5)
```

## Managing Configuration

```bash
anakot config              # View current configuration
anakot config edit         # Open config.yaml in your editor
anakot config set KEY VAL  # Set a specific value
anakot config check        # Check for missing options (after updates)
anakot config migrate      # Interactively add missing options

# Examples:
anakot config set model anthropic/claude-sonnet-4
anakot config set terminal.backend docker
```

> **Tip:** The `anakot config set` command automatically routes values to the right file — API keys are saved to `.env`, everything else to `config.yaml`.

## Configuration Precedence

Settings are resolved in this order (highest priority first):

1. **CLI arguments** — e.g., `anakot chat --model anthropic/claude-sonnet-4`
2. **`~/.anakot/config.yaml`** — the primary config file for all non-secret settings
3. **`~/.anakot/.env`** — fallback for env vars; required for secrets
4. **Built-in defaults** — hardcoded safe defaults

> **Rule of Thumb:** Secrets (API keys, bot tokens, passwords) go in `.env`. Everything else goes in `config.yaml`.

## Key Config Sections

### Model

```yaml
model:
  main:
    provider: openrouter
    model: openrouter/owl-alpha
  auxiliary:
    provider: openrouter
    model: openrouter/owl-alpha
```

### Agent

```yaml
agent:
  max_iterations: 90
  max_tool_output_chars: 50000
  skip_context_files: false
  skip_memory: false
```

### Terminal

```yaml
terminal:
  backend: local    # local | docker | ssh | modal | daytona | singularity
  cwd: "."          # Working directory
  timeout: 180      # Command timeout in seconds
  env_passthrough: []  # Env var names to forward to sandboxed execution
```

### Display

```yaml
display:
  interface: "cli"           # "cli" = classic REPL, "tui" = Ink TUI
  busy_input_mode: "interrupt"  # interrupt | queue | steer
  show_reasoning: false
  streaming: false
  bell_on_complete: false
  tool_progress: "all"       # off | new | all | verbose
  tui_status_indicator: "kaomoji"  # kaomoji | emoji | unicode | ascii
```

### Compression

```yaml
compression:
  enabled: true
  max_context_tokens: 100000
  keep_recent_tokens: 20000
```

### Memory

```yaml
memory:
  enabled: true
  provider: builtin    # builtin | honcho | mem0 | supermemory
```

### Skills

```yaml
skills:
  enabled: true
  external_dirs:       # Additional skill directories
    - ~/.agents/skills
```

### Gateway

```yaml
gateway:
  platforms:
    telegram:
      enabled: true
      bot_token: ${TELEGRAM_BOT_TOKEN}
    discord:
      enabled: false
      bot_token: ${DISCORD_BOT_TOKEN}
```

### Cron

```yaml
cron:
  enabled: true
  tick_interval_seconds: 60
```

### Profiles

```yaml
profiles:
  active: default
```

### Plugins

```yaml
plugins:
  enabled: true
  load:
    - openrouter
    - anthropic
```

### Logging

```yaml
logging:
  level: INFO
  file: ~/.anakot/logs/agent.log
  max_bytes: 10485760  # 10 MB
  backup_count: 5
```

### Security / Approvals

```yaml
approvals:
  mode: manual    # manual | smart | off
```

Modes:
- `manual` — prompts for every command (default)
- `smart` — auto-approves low-risk, prompts for dangerous (recommended)
- `off` — no prompts (equivalent to `--yolo`)

### Delegation

```yaml
delegation:
  max_concurrent_children: 3
  max_spawn_depth: 1
```

## Environment Variable Substitution

You can reference environment variables in config.yaml using `${VAR_NAME}` syntax:

```yaml
auxiliary:
  vision:
    api_key: ${GOOGLE_API_KEY}
```

If a referenced variable is not set, the placeholder is kept verbatim.

## Key Environment Variables

| Var | Purpose |
|-----|---------|
| `ANAKOT_HOME` | Override home directory |
| `ANAKOT_PROFILE` | Active profile name |
| `ANAKOT_TUI=1` | Use TUI mode |
| `TERMINAL_ENV` | Terminal backend: `local`, `docker`, `ssh`, etc. |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google API key |

## Terminal Backend Configuration

Anakot supports six terminal backends:

| Backend | Where commands run | Isolation | Best for |
|---------|-------------------|-----------|----------|
| `local` | Your machine directly | None | Development, personal use |
| `docker` | Single persistent Docker container | Full (namespaces, cap-drop) | Safe sandboxing, CI/CD |
| `ssh` | Remote server via SSH | Network boundary | Remote dev, powerful hardware |
| `modal` | Modal cloud sandbox | Full (cloud VM) | Ephemeral cloud compute |
| `daytona` | Daytona workspace | Full (cloud container) | Managed cloud dev environments |
| `singularity` | Singularity/Apptainer container | Namespaces (--containall) | HPC clusters, shared machines |

### Local Backend (Default)

```yaml
terminal:
  backend: local
```

### Docker Backend

```yaml
terminal:
  backend: docker
  docker_image: "python:3.11-slim"
  docker_forward_env:
    - "GITHUB_TOKEN"
  container_cpu: 1
  container_memory: 5120
  container_persistent: true
```

One persistent container, shared across the whole process. Working-directory changes, installed packages, and files in `/workspace` all carry over from one tool call to the next.

### SSH Backend

```yaml
terminal:
  backend: ssh
```

```bash
# In ~/.anakot/.env
TERMINAL_SSH_HOST=my-server.example.com
TERMINAL_SSH_USER=ubuntu
TERMINAL_SSH_KEY=~/.ssh/id_rsa
```

## Profile & Multi-User Architecture

Profiles: `~/.anakot/profiles/<name>/` (each has own skills/, plugins/, cron/, memories/)

Active profile tracked in `~/.anakot/profiles/active_profile`

### Rules for Profile-Safe Code

1. **Use `get_anakot_home()`** for all paths — never hardcode `~/.anakot`
2. **Use `display_anakot_home()`** for user-facing messages
3. **Module-level constants** cache at import time (after profile override)
4. **Tests** that mock `Path.home()` must also set `ANAKOT_HOME`

## Update Behavior

```yaml
updates:
  pre_update_backup: false
  backup_keep: 5
  non_interactive_local_changes: stash  # stash | discard
```

For git installs, Anakot auto-stashes dirty tracked files before checking out the update branch. Non-interactive updates use `stash` (restores local edits) or `discard` (drops them).

## See Also

- **[[CLI Guide]]** — Classic prompt_toolkit CLI interface
- **[[TUI Guide]]** — Modern terminal UI with Ink/React
- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[Messaging Gateway]]** — Telegram, Discord, Slack, and 20+ platforms
