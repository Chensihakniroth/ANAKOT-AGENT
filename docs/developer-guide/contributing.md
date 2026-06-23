# Contributing — Anakot Agent

> Development workflows, policies, and standards for contributors.

## Development Environment

```bash
source .venv/bin/activate   # or: source venv/bin/activate
```

`scripts/run_tests.sh` probes `.venv` first, then `venv`, then `$HOME/.anakot/anakot-agent/venv`.

## Adding New Tools

Built-in/core tools require changes in **2 files**:

**1. Create `tools/your_tool.py`:**

```python
from tools.registry import registry

def example_tool(param: str, task_id: str = None) -> str:
    return json.dumps({"success": True, "data": "..."})

registry.register(
    name="example_tool",
    toolset="example",
    schema={"name": "example_tool", "description": "...", "parameters": {...}},
    handler=lambda args, **kw: example_tool(param=args.get("param", ""), task_id=kw.get("task_id")),
    requires_env=["EXAMPLE_API_KEY"],
)
```

**2. Add to `toolsets.py`** — either `_ANAKOT_CORE_TOOLS` or a new toolset.

Auto-discovery: any `tools/*.py` file with a top-level `registry.register()` call is imported automatically.

## Adding Configuration

### config.yaml options:
1. Add to `DEFAULT_CONFIG` in `anakot_cli/config.py`
2. Bump `_config_version` only if you need to actively migrate/transform existing user config

### .env variables (SECRETS ONLY):
1. Add to `OPTIONAL_ENV_VARS` in `anakot_cli/config.py` with metadata

Non-secret settings belong in `config.yaml`, not `.env`.

## Adding a Slash Command

1. Add a `CommandDef` entry to `COMMAND_REGISTRY` in `anakot_cli/commands.py`
2. Add handler in `AnakotCLI.process_command()` in `cli.py`
3. If gateway-available, add handler in `gateway/run.py`

## Dependency Pinning Policy

All dependencies must have upper bounds to limit supply-chain attack surface.

| Source type | Treatment |
|---|---|
| PyPI package | `>=floor,<next_major` — e.g. `"httpx>=0.28.1,<1"` |
| Git URL | Commit SHA |
| GitHub Actions | Commit SHA + comment |

**Never commit a bare `>=X.Y.Z` without a ceiling.**

## TypeScript Style

- Prefer small nanostores over component state when state is shared
- Let each feature own its atoms
- Keep route roots thin — they compose routes and shell
- No monolithic hooks — a hook should own one narrow job
- Prefer interfaces for public props and shared object shapes
- Table-driven beats condition ladders

## Skin/Theme System

Skins are **pure data** — no code changes needed.

| Element | Skin Key |
|---------|----------|
| Banner panel border | `colors.banner_border` |
| Spinner faces | `spinner.waiting_faces` / `spinner.thinking_faces` |
| Spinner verbs | `spinner.thinking_verbs` |
| Tool output prefix | `tool_prefix` |
| Agent name | `branding.agent_name` |

Built-in skins: `default`, `ares`, `mono`, `slate`.

## Skills

### SKILL.md Frontmatter

Standard fields: `name`, `description`, `version`, `author`, `license`, `platforms`, `metadata.anakot.tags`, `metadata.anakot.category`.

### Skill Authoring Standards

1. **`description` ≤ 60 characters**, one sentence, ends with a period
2. **Tools referenced must be native Anakot tools** — use `terminal`, `read_file`, `patch`, `search_files`, etc.
3. **`platforms:` gating** audited against actual script imports
4. **`author`** credits the human contributor first
5. **Modern section order:** `# <Skill> Skill`, `## When to Use`, `## Prerequisites`, `## How to Run`, `## Quick Reference`, `## Procedure`, `## Pitfalls`, `## Verification`
6. **Scripts** go in `scripts/`, references in `references/`, templates in `templates/`
7. **Tests** live at `tests/skills/test_<skill>_skill.py`

## Delegation (`delegate_task`)

Two shapes:
- **Single:** pass `goal` (+ optional `context`, `toolsets`)
- **Batch (parallel):** pass `tasks: [...]` — each gets its own subagent

Roles: `role="leaf"` (default, cannot delegate further) or `role="orchestrator"` (can spawn workers).

> **Synchronicity rule:** `delegate_task` is NOT durable. For long-running work, use `cronjob` or `terminal(background=True)`.

## Kanban (Multi-Agent Work Queue)

Durable SQLite-backed board for multi-agent collaboration.
- **CLI:** `anakot kanban` with verbs: `init`, `create`, `list`, `show`, `assign`, `complete`, `block`, etc.
- **Board** is the hard boundary; **tenant** is a soft namespace within a board

## Important Policies

### Prompt Caching Must Not Break

Do NOT:
- Alter past context mid-conversation
- Change toolsets mid-conversation
- Reload memories or rebuild system prompts mid-conversation

### Known Pitfalls

- **DO NOT hardcode `~/.anakot` paths** — use `get_anakot_home()`
- **DO NOT use `\033[K`** in spinner/display code — use space-padding
- **DO NOT hardcode cross-tool references** in schema descriptions
- **Tests must not write to `~/.anakot/`** — use the isolation fixture
- **DO NOT introduce new `simple_term_menu` usage** — use curses

## Testing

**ALWAYS use `scripts/run_tests.sh`** — do not call `pytest` directly.

```bash
scripts/run_tests.sh                                  # full suite
scripts/run_tests.sh tests/gateway/                   # one directory
scripts/run_tests.sh tests/agent/test_foo.py::test_x  # one test
scripts/run_tests.sh --no-isolate tests/foo/          # debugging (no isolation)
```

- ~17k tests across ~900 files
- Per-test process isolation via `pytest-isolate` plugin
- API keys are blanked during tests

### Don't Write Change-Detector Tests

**Do not write:**
```python
assert "gemini-2.5-pro" in _PROVIDER_MODELS["gemini"]
assert DEFAULT_CONFIG["_config_version"] == 21
```

**Do write:**
```python
assert "gemini" in _PROVIDER_MODELS
assert len(_PROVIDER_MODELS["gemini"]) >= 1
assert raw["_config_version"] == DEFAULT_CONFIG["_config_version"]
```

The rule: assert the relationship, not the specific names.

## CI/CD

Every push to `main` or PR triggers:

| Check | What It Catches | Blocking? |
|---|---|---|
| **ruff** (lint) | Syntax errors, style issues | ✅ Yes |
| **ruff** (diff) | New lint issues vs base branch | ❌ No (advisory) |
| **ty** (type check) | Type errors | ❌ No (advisory) |
| **Windows footgun checker** | Windows-unsafe Python patterns | ✅ Yes |
| **Test suite** (6 parallel slices) | Logic bugs, regressions | ✅ Yes |
| **E2E tests** | Integration tests | ✅ Yes |

### Required Checks Before Merge

1. ✅ `ruff-blocking` — lint enforcement
2. ✅ `windows-footguns` — Windows safety guardrails
3. ✅ `test` (all 6 slices) — full test suite
4. ✅ `e2e` — end-to-end tests

### Quick Commands

```bash
# Check CI status on the latest push
gh run list --limit 5

# View a specific run
gh run view <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed
```

## Common Modification Checklist

- [ ] Identify the layer (tool, plugin, skill, command, provider)
- [ ] Follow the self-register pattern (registry, CommandDef, plugin.yaml)
- [ ] Add to `_ANAKOT_CORE_TOOLS` or `TOOLSETS` if it's a tool
- [ ] Add to `DEFAULT_CONFIG` if it needs config
- [ ] Add to `.env.example` if it needs env vars
- [ ] Add tests in `tests/`
- [ ] Update `skills/` or `docs/` if user-facing

## See Also

- **[[Architecture]]** — How it works under the hood
- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[Skills System]]** — Procedural memory the agent creates and reuses
- **[[Configuration]]** — Config file, providers, models, options
- **[[Development Guide (Obsidian)]]** — Dev workflows, policies, and standards
