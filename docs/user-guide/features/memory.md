# Persistent Memory — Anakot Agent

> Anakot Agent has bounded, curated memory that persists across sessions. This lets it remember your preferences, your projects, your environment, and things it has learned.

## How It Works

Two files make up the agent's memory:

| File | Purpose | Char Limit |
|------|---------|------------|
| `MEMORY.md` | Agent's personal notes — environment facts, conventions, things learned | 2,200 chars (~800 tokens) |
| `USER.md` | User profile — your preferences, communication style, expectations | 1,375 chars (~500 tokens) |

Both are stored in `~/.anakot/memories/` and are injected into the system prompt as a frozen snapshot at session start. The agent manages its own memory via the `memory` tool — it can add, replace, or remove entries.

> **Note:** Character limits keep memory focused. When memory is full, the agent consolidates or replaces entries to make room for new information.

## How Memory Appears in the System Prompt

At the start of every session, memory entries are loaded from disk and rendered into the system prompt as a frozen block:

```
══════════════════════════════════════════════
MEMORY (your personal notes) [67% — 1,474/2,200 chars]
══════════════════════════════════════════════
User's project is a Rust web service at ~/code/myapi using Axum + SQLx
§
This machine runs Ubuntu 22.04, has Docker and Podman installed
§
User prefers concise responses, dislikes verbose explanations
```

The format includes:
- A header showing which store (MEMORY or USER PROFILE)
- Usage percentage and character counts so the agent knows capacity
- Individual entries separated by `§` (section sign) delimiters
- Entries can be multiline

**Frozen snapshot pattern:** The system prompt injection is captured once at session start and never changes mid-session. This is intentional — it preserves the LLM's prefix cache for performance. When the agent adds/removes memory entries during a session, the changes are persisted to disk immediately but won't appear in the system prompt until the next session starts.

## Memory Tool Actions

The agent uses the `memory` tool with these actions:

| Action | Description |
|--------|-------------|
| `add` | Add a new memory entry |
| `replace` | Replace an existing entry (uses substring matching via `old_text`) |
| `remove` | Remove an entry that's no longer relevant (uses substring matching via `old_text`) |

There is no read action — memory content is automatically injected into the system prompt at session start.

## Substring Matching

The `replace` and `remove` actions use short unique substring matching — you don't need the full entry text:

```
# If memory contains "User prefers dark mode in all editors"
memory(action="replace", target="memory",
       old_text="dark mode",
       content="User prefers light mode in VS Code, dark mode in terminal")
```

If the substring matches multiple entries, an error is returned asking for a more specific match.

## Two Targets Explained

### `memory` — Agent's Personal Notes

For information the agent needs to remember about the environment, workflows, and lessons learned:
- Environment facts (OS, tools, project structure)
- Project conventions and configuration
- Tool quirks and workarounds discovered
- Skills and techniques that worked

### `user` — User Profile

For information about the user's identity, preferences, and communication style:
- Name, role, timezone
- Communication preferences (concise vs detailed, format preferences)
- Pet peeves and things to avoid
- Workflow habits
- Technical skill level

## What to Save vs Skip

### Save These (Proactively)

The agent saves automatically — you don't need to ask. It saves when it learns:
- **User preferences:** "I prefer TypeScript over JavaScript" → save to `user`
- **Environment facts:** "This server runs Debian 12 with PostgreSQL 16" → save to `memory`
- **Corrections:** "Don't use sudo for Docker commands, user is in docker group" → save to `memory`
- **Conventions:** "Project uses tabs, 120-char line width, Google-style docstrings" → save to `memory`
- **Explicit requests:** "Remember that my API key rotation happens monthly" → save to `memory`

### Skip These

- **Trivial/obvious info:** "User asked about Python" — too vague to be useful
- **Easily re-discovered facts:** "Python 3.12 supports f-string nesting" — can web search this
- **Raw data dumps:** Large code blocks, log files, data tables — too big for memory
- **Session-specific ephemera:** Temporary file paths, one-off debugging context

## Capacity Management

Memory has strict character limits to keep system prompts bounded:

| Store | Limit | Typical entries |
|-------|-------|-----------------|
| `memory` | 2,200 chars | 8-15 entries |
| `user` | 1,375 chars | 5-10 entries |

### What Happens When Memory is Full

When you try to add an entry that would exceed the limit, the tool returns an error with the current entries and usage. The agent should then:
1. Read the current entries (shown in the error response)
2. Identify entries that can be removed or consolidated
3. Use `replace` to merge related entries into shorter versions
4. Then add the new entry

> **Best practice:** When memory is above 80% capacity (visible in the system prompt header), consolidate entries before adding new ones.

## Practical Examples of Good Memory Entries

```
# Good: Packs multiple related facts
User runs macOS 14 Sonoma, uses Homebrew, has Docker Desktop and Podman.
Shell: zsh with oh-my-zsh. Editor: VS Code with Vim keybindings.

# Good: Specific, actionable convention
Project ~/code/api uses Go 1.22, sqlc for DB queries, chi router.
Run tests with 'make test'. CI via GitHub Actions.

# Good: Lesson learned with context
The staging server (10.0.1.50) needs SSH port 2222, not 22.
Key is at ~/.ssh/staging_ed25519.

# Bad: Too vague
User has a project.

# Bad: Too verbose
On January 5th, 2026, the user asked me to look at their project which is
located at ~/code/api. I discovered it uses Go version 1.22 and...
```

## Duplicate Prevention

The memory system automatically rejects exact duplicate entries. If you try to add content that already exists, it returns success with a "no duplicate added" message.

## Security Scanning

Memory entries are scanned for injection and exfiltration patterns before being accepted, since they're injected into the system prompt. Content matching threat patterns (prompt injection, credential exfiltration, SSH backdoors) or containing invisible Unicode characters is blocked.

## Session Search

Beyond MEMORY.md and USER.md, the agent can search its past conversations using the `session_search` tool:

- All CLI and messaging sessions are stored in SQLite (`~/.anakot/state.db`) with FTS5 full-text search
- Search queries return actual messages from the DB — no LLM summarization, no truncation
- Supports boolean queries (`AND`, `OR`, `NOT`), quoted phrases, and prefix wildcards

## See Also

- **[[Skills System]]** — Procedural memory the agent creates and reuses
- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[Configuration]]** — Config file, providers, models, options
