# Hermes Docs Reference — Anakot Adaptation Guide

> Anakot is a fork of Hermes Agent by Nous Research. This file maps Hermes documentation structure to Anakot's actual implementation. When writing or updating docs, follow Hermes' organization and writing style, but substitute Anakot's technical details.

## Why This Exists

Hermes docs are well-structured and battle-tested. Rather than inventing a new documentation format from scratch, we follow their page hierarchy and writing conventions — then fill in Anakot-specific technical content.

## Navigation Structure Comparison

```
Hermes (upstream)                              Anakot (this project)
─────────────────                              ────────────────────────
/
├── user-stories/                              (Obsidian vault: System Notes)
├── getting-started/                           getting-started/
│   ├── installation.md                        ├── Setup Guide (Obsidian)
│   ├── quickstart.md                          ├── quickstart.md (NEW)
│   └── learning-path.md                       (skip)
├── using-hermes/  [user-guide]                user-guide/
│   ├── cli.md                                 ├── cli.md
│   ├── tui.md                                 ├── tui.md
│   └── desktop.md                             (skip — no desktop app)
├── features/                                  user-guide/features/
│   ├── overview.md                            ├── (merged into index)
│   ├── tools.md                               ├── tools.md
│   ├── skills.md                              ├── skills.md
│   ├── memory.md                              ├── memory.md
│   ├── voice-mode.md                          (skip — no voice mode)
│   ├── personality.md                          (Obsidian: System Notes)
│   ├── context-files.md                       (Obsidian: Dev Guide)
│   ├── skins.md skins-and-themes.md           ├── (merged into cli.md)
│   └── mcp.md                                 (skip or minimal)
├── messaging/  [user-guide/messaging]          user-guide/
│   ├── index.md                               ├── messaging.md
│   ├── telegram.md                            (merged into messaging.md)
│   ├── discord.md                             (merged into messaging.md)
│   └── platform pages...                      (merged)
├── integrations/                              (skip — no Nous Portal)
│   ├── nous-portal.md                         (skip)
│   └── ...other integrations                  (Obsidian: Dev Guide)
├── guides/                                    (skip or minimal)
│   ├── tips.md                                (skip)
│   └── run-nemotron-3-ultra-free.md          (skip)
├── developer-guide/                           developer-guide/
│   ├── contributing.md                        ├── contributing.md
│   ├── architecture.md                        ├── architecture.md
│   └── internals/ (sub-pages)                 (merged into architecture.md)
└── reference/
    ├── cli-commands.md                        (merged into cli.md)
    └── faq.md                                 (Obsidian: Setup Guide troubleshooting)
```

## Anakot-Specific Additions (Not in Hermes)

These are features Anakot has that Hermes doesn't:

| Feature | Where to document |
|---------|-------------------|
| **Web Dashboard** (FastAPI + React, port 9119) | `user-guide/dashboard.md` + Obsidian `Web Dashboard.md` |
| **Dashboard Theme System** (YAML themes, `~/.anakot/dashboard-themes/`) | Merged into dashboard.md |
| **Skin/Engine System** (built-in + user YAML skins) | `user-guide/cli.md` or Obsidian Dev Guide |
| **Windows-native support** (MSYS bash, `anakot_bootstrap.py`, UTF-8 stdio) | `user-guide/cli.md` + Setup Guide |
| **TUI Gateway** (`tui_gateway/` — Python JSON-RPC backend) | `user-guide/tui.md` (lives in Obsidian TUI Guide) |
| **TUI Ink fork** (`ui-tui/packages/anakot-ink/`) | `user-guide/tui.md` |
| **Windows footgun checker** (CI safety for `os.kill`, etc.) | `developer-guide/contributing.md` |
| **Kanban system** (SQLite-backed multi-agent board) | `user-guide/features/kanban.md` (optional) |
| **Plugin dashboard extensions** (`manifest.json` slots) | `user-guide/dashboard.md` |
| **Productivity integrations** (Notion, Airtable, Google Workspace, etc.) | `user-guide/integrations.md` (optional) |

## Anakot-Specific Renames

| Hermes name | Anakot name | Notes |
|-------------|-------------|-------|
| `hermes` command | `anakot` command | All CLI examples use `anakot` |
| `~/.hermes/` | `~/.anakot/` | Directory renamed |
| `hermes_state.py` | `anakot_state.py` | Renamed |
| `hermes_constants.py` | `anakot_constants.py` | Renamed |
| `hermes_cli/` | `anakot_cli/` | Renamed |
| `hermes setup --portal` | `anakot setup` | No Nous Portal |
| Authored by **Nous Research** | Authored by **callmemo** | Branding |
| Title: **Hermes Agent** | Title: **Anakot Agent** (អនាគត) | Khmer for "future" |

## Writing Style Conventions (from Hermes)

Follow these patterns from the Hermes docs:

1. **Page title** = `Topic | Anakot Agent` (not `Hermes Agent`)
2. **Opening paragraph** = one-sentence value proposition of the feature
3. **Quick setup** section with copy-pasteable code blocks (bash for POSIX, powershell for Windows)
4. **Tables over prose** for comparisons (platforms, backends, config options)
5. **Admonitions** for tips/warnings: `> **Note:**`, `> **Tip:**`, `> **Warning:**`
6. **Code blocks** with language tags: `bash`, `powershell`, `yaml`, `python`, `json`
7. **Keyboard shortcuts** in `code` formatting within tables
8. **Configuration examples** in YAML with comments explaining each field
9. **Troubleshooting** table at the end of user-facing pages: `| Problem | Fix |`
10. **"See Also"** section at the bottom linking to related pages

## Key URLs

- **Hermes upstream docs:** https://hermes-agent.nousresearch.com/docs/
- **Anakot GitHub:** https://github.com/callmemo/anakot-agent
- **Anakot Obsidian vault:** `C:\Users\Niroth\Documents\Obsidian Vault\Anakot Agent\`
- ⚠️ `https://anakot-agent.callmemo.ai/docs` is NOT a real URL — never reference it

## Maintenance

When Hermes upstream docs are updated:
1. Check if the page structure changed
2. Adapt the structure for Anakot (rename, add/remove sections)
3. Update technical details to match Anakot's implementation
4. Keep the Anakot-specific additions intact

---

_Last updated: 2026-06-11_
