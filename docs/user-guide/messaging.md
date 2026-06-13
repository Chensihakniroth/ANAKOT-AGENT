# Messaging Gateway — Anakot Agent

> Chat with Anakot from Telegram, Discord, Slack, WhatsApp, Signal, SMS, Email, Home Assistant, Mattermost, Matrix, DingTalk, Feishu/Lark, WeCom, Weixin, BlueBubbles (iMessage), QQ, Yuanbao, Microsoft Teams, LINE, ntfy, or your browser. The gateway is a single background process that connects to all your configured platforms.

## Platform Comparison

| Platform | Voice | Images | Files | Threads | Reactions | Typing | Streaming |
|----------|-------|--------|-------|---------|-----------|--------|-----------|
| Telegram | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Discord | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slack | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WhatsApp | — | ✅ | ✅ | — | — | ✅ | ✅ |
| Signal | — | ✅ | ✅ | — | — | ✅ | ✅ |
| SMS | — | — | — | — | — | — | — |
| Email | — | ✅ | ✅ | ✅ | — | — | — |
| Matrix | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Feishu/Lark | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WeCom | ✅ | ✅ | ✅ | — | — | — | — |
| Weixin | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| Yuanbao | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |

*Voice = TTS audio replies and/or voice message transcription. Streaming = progressive message updates via editing.*

## Architecture

Each platform adapter receives messages, routes them through a per-chat session store, and dispatches them to the AIAgent for processing. The gateway also runs the cron scheduler, ticking every 60 seconds to execute any due jobs.

## Quick Setup

The easiest way to configure messaging platforms is the interactive wizard:

```bash
anakot gateway setup        # Interactive setup for all messaging platforms
```

## Gateway Commands

```bash
anakot gateway              # Run in foreground
anakot gateway setup        # Configure messaging platforms interactively
anakot gateway install      # Install as a user service (Linux) / launchd service (macOS)
anakot gateway start        # Start the default service
anakot gateway stop         # Stop the default service
anakot gateway status       # Check default service status
```

## Chat Commands (Inside Messaging)

| Command | Description |
|---------|-------------|
| `/new` or `/reset` | Start a fresh conversation |
| `/model [provider:model]` | Show or change the model |
| `/personality [name]` | Set a personality |
| `/retry` | Retry the last message |
| `/undo` | Remove the last exchange |
| `/status` | Show session info |
| `/stop` | Stop the running agent |
| `/approve` | Approve a pending dangerous command |
| `/deny` | Reject a pending dangerous command |
| `/compress` | Manually compress conversation context |
| `/title [name]` | Set or show the session title |
| `/usage` | Show token usage for this session |
| `/reasoning [level\|show\|hide]` | Change reasoning effort or toggle display |
| `/background <prompt>` | Run a prompt in a separate background session |
| `/update` | Update Anakot to the latest version |
| `/help` | Show available commands |
| `/<skill-name>` | Invoke any installed skill |

## Session Management

### Session Persistence

Sessions persist across messages until they reset. The agent remembers your conversation context.

### Reset Policies

| Policy | Default | Description |
|--------|---------|-------------|
| Daily | 4:00 AM | Reset at a specific hour each day |
| Idle | 1440 min | Reset after N minutes of inactivity |
| Both | (combined) | Whichever triggers first |

Configure per-platform overrides in `~/.anakot/config.yaml`:

```yaml
gateway:
  reset_by_platform:
    telegram:
      mode: "idle"
      idle_minutes: 240
    discord:
      mode: "idle"
      idle_minutes: 60
```

## Security

By default, the gateway denies all users who are not in an allowlist or paired via DM. This is the safe default for a bot with terminal access.

### Allowlists

```bash
# In ~/.anakot/.env
TELEGRAM_ALLOWED_USERS=123456789,987654321
DISCORD_ALLOWED_USERS=123456789012345678
SIGNAL_ALLOWED_USERS=+155****4567,+155****6543
```

### DM Pairing (Alternative to Allowlists)

Instead of manually configuring user IDs, unknown users receive a one-time pairing code when they DM the bot:

```bash
# The user sees: "Pairing code: XKGH5N7P"
# You approve them with:
anakot pairing approve telegram XKGH5N7P

# Other pairing commands:
anakot pairing list                    # View pending + approved users
anakot pairing revoke telegram 123456789  # Remove access
```

Pairing codes expire after 1 hour, are rate-limited, and use cryptographic randomness.

### Admins vs Regular Users

Every allowed user falls into one of two tiers per scope (DM vs group/channel):

- **Admin** — full access. Can run every registered slash command.
- **Regular user** — restricted access. Can chat normally, but can only run explicitly enabled slash commands.

```yaml
gateway:
  platforms:
    discord:
      extra:
        allow_from: ["111", "222", "333"]
        allow_admin_from: ["111"]           # admins → all slash commands
        user_allowed_commands: [status, model]  # what non-admins may run
```

## Interrupting the Agent

Send any message while the agent is working to interrupt it:
- In-progress terminal commands are killed immediately
- Tool calls are cancelled — only the currently-executing one runs
- Multiple messages are combined into one prompt
- `/stop` command — interrupts without queuing a follow-up

### Busy Input Modes

| Mode | Behavior |
|------|----------|
| `interrupt` (default) | Your message interrupts the current operation immediately |
| `queue` | Your message waits and runs as the next turn |
| `steer` | Your message is injected into the current run via `/steer` |

```yaml
display:
  busy_input_mode: steer   # or queue, or interrupt
  busy_ack_enabled: true   # set to false to suppress the busy-ack reply
```

## Tool Progress Notifications

Control how much tool activity is displayed:

```yaml
display:
  tool_progress: all    # off | new | all | verbose
```

When enabled, the bot sends status messages as it works:
```
💻 `ls -la`...
🔍 web_search...
📄 web_extract...
🐍 execute_code...
```

## Background Sessions

Run a prompt in a separate background session so the agent works on it independently while your main chat stays responsive:

```
/background Check all servers in the cluster and report any that are down
```

Each `/background` prompt spawns a separate agent instance that runs asynchronously:
- **Isolated session** — its own conversation history, no knowledge of your current chat
- **Same configuration** — inherits your model, provider, toolsets
- **Non-blocking** — your main chat stays fully interactive
- **Result delivery** — when the task finishes, the result is sent back to the same chat

## Key Files

| File | Purpose |
|------|---------|
| `gateway/run.py` | `GatewayRunner` — manages platform adapter lifecycle, agent cache (LRU, 128 max) |
| `gateway/session.py` | SessionStore — conversation persistence |
| `gateway/delivery.py` | Outbound message delivery |
| `gateway/pairing.py` | DM pairing authorization |
| `gateway/hooks.py` | Hook discovery and lifecycle events |
| `gateway/platforms/base.py` | `PlatformAdapter` ABC |
| `gateway/platforms/telegram.py` | Telegram adapter |
| `gateway/platforms/discord.py` | Discord adapter |
| `gateway/platforms/signal.py` | Signal adapter |
| `gateway/platforms/feishu.py` | Feishu (Lark) adapter |

## See Also

- **[[Configuration]]** — Config file, providers, models, options
- **[[CLI Guide]]** — Classic prompt_toolkit CLI interface
- **[[Cron Jobs]]** — Scheduled automations
