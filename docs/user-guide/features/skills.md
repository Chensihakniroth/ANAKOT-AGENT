# Skills System — Anakot Agent

> Skills are on-demand knowledge documents the agent can load when needed. They follow a progressive disclosure pattern to minimize token usage and are compatible with the agentskills.io open standard.

## How Skills Work

Every installed skill is automatically available as a slash command:

```
/gif-search funny cats
/plan design a rollout for migrating our auth provider
/github-pr-workflow create a PR for the auth refactor

# Just the skill name loads it and lets the agent ask what you need:
/excalidraw
```

You can also interact with skills through natural conversation:

```
> What skills do you have?
> Show me the plan skill
```

## Progressive Disclosure

Skills use a token-efficient loading pattern:

| Level | Tool Call | Returns | Token Cost |
|-------|-----------|---------|------------|
| 0 | `skills_list()` | `[{name, description, category}, ...]` | ~3k tokens |
| 1 | `skill_view(name)` | Full content + metadata | Varies |
| 2 | `skill_view(name, path)` | Specific reference file | Varies |

The agent only loads the full skill content when it actually needs it.

## SKILL.md Format

```yaml
---
name: my-skill
description: Brief description of what this skill does.
version: 1.0.0
platforms: [macos, linux]     # Optional — restrict to specific OS platforms
metadata:
  anakot:
    tags: [python, automation]
    category: devops
    fallback_for_toolsets: [web]    # Optional — conditional activation
    requires_toolsets: [terminal]   # Optional — conditional activation
---

# Skill Title

## When to Use
Trigger conditions for this skill.

## Prerequisites
What must be in place before running this skill.

## How to Run
Quick-start commands.

## Quick Reference
Key commands, flags, or options.

## Procedure
1. Step one
2. Step two

## Pitfalls
- Known failure modes and fixes

## Verification
How to confirm it worked.
```

## Skill Directory Structure

```
~/.anakot/skills/                  # Single source of truth
├── devops/                        # Category directory
│   └── deploy-k8s/
│       ├── SKILL.md               # Main instructions (required)
│       ├── references/            # Additional docs
│       ├── templates/             # Output formats
│       ├── scripts/               # Helper scripts
│       └── assets/                # Supplementary files
├── mlops/
│   └── axolotl/
│       └── SKILL.md
├── .hub/                          # Skills Hub state
│   ├── lock.json
│   └── audit.log
└── .bundled_manifest              # Tracks seeded bundled skills
```

## Bundled vs Optional Skills

Anakot ships with two parallel skill surfaces:

- **`skills/`** — built-in skills shipped and loadable by default
- **`optional-skills/`** — heavier/niche skills, installed via `anakot skills install official/<category>/<skill>`

Categories include: `autonomous-ai-agents`, `creative`, `data-science`, `email`, `github`, `media`, `mlops`, `note-taking`, `productivity`, `research`, `smart-home`, `software-development`, `yuanbao`, and more.

## Managing Skills

```bash
# List installed skills
anakot skills list

# Search for skills
anakot skills search github

# Install from skills hub
anakot skills install <id>

# In-session:
/skill <name>          # Load a specific skill
/skills                # Browse/search
```

## Platform-Specific Skills

Skills can restrict themselves to specific operating systems:

```yaml
platforms: [macos]            # macOS only
platforms: [macos, linux]     # macOS and Linux
platforms: [windows]          # Windows only
```

When set, the skill is automatically hidden from the system prompt, `skills_list()`, and slash commands on incompatible platforms.

## Conditional Activation (Fallback Skills)

Skills can automatically show or hide themselves based on which tools are available:

```yaml
metadata:
  anakot:
    fallback_for_toolsets: [web]      # Show ONLY when these toolsets are unavailable
    requires_toolsets: [terminal]     # Show ONLY when these toolsets are available
    fallback_for_tools: [web_search]  # Show ONLY when these specific tools are unavailable
    requires_tools: [terminal]        # Show ONLY when these specific tools are available
```

| Field | Behavior |
|-------|----------|
| `fallback_for_toolsets` | Hidden when listed toolsets are available. Shown when missing. |
| `fallback_for_tools` | Same, but checks individual tools. |
| `requires_toolsets` | Hidden when listed toolsets are unavailable. Shown when present. |
| `requires_tools` | Same, but checks individual tools. |

## External Skill Directories

If you maintain skills outside of Anakot, you can tell Anakot to scan those directories too:

```yaml
# ~/.anakot/config.yaml
skills:
  external_dirs:
    - ~/.agents/skills
    - /home/shared/team-skills
```

- **Local precedence:** If the same skill name exists in both the local dir and an external dir, the local version wins.
- **Full integration:** External skills appear in the system prompt index, `skills_list`, `skill_view`, and as `/skill-name` slash commands.
- **Non-existent paths are silently skipped.**

## Skill Authoring Standards

1. **`description` ≤ 60 characters**, one sentence, ends with a period
2. **Tools referenced must be native Anakot tools** — use `terminal`, `read_file`, `patch`, `search_files`, etc.
3. **`platforms:` gating** audited against actual script imports
4. **Modern section order:** `# <Skill> Skill`, `## When to Use`, `## Prerequisites`, `## How to Run`, `## Quick Reference`, `## Procedure`, `## Pitfalls`, `## Verification`
5. **Scripts** go in `scripts/`, references in `references/`, templates in `templates/`
6. **Tests** live at `tests/skills/test_<skill>_skill.py`

## Curator (Skill Lifecycle)

Background skill-maintenance system that tracks usage and auto-archives stale skills.
- Only touches skills with `created_by: "agent"` provenance
- Never deletes; max destructive action is archive
- Pinned skills are exempt from every auto-transition

## See Also

- **[[Tools & Toolsets]]** — 60+ built-in tools
- **[[CLI Guide]]** — Classic prompt_toolkit CLI interface
- **[[Configuration]]** — Config file, providers, models, options
