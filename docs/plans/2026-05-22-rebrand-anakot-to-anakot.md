# Rebrand Anakot to Anakot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand "Anakot" to "Anakot" in all `.md` files in `D:\School\PROJECT\anakot-agent`, focusing on branding and user instructions, while preserving internal identifiers and file paths. Remove "Contributors" and "Credits" sections from specified files.

**Architecture:**
- Use a subagent to perform batch replacements with refined regex to distinguish branding/user instructions from internal paths/identifiers.
- Manually review and clean up specific files: README.md, AGENTS.md, SECURITY.md, and CONTRIBUTING.md.
- Ensure URLs pointing to the project are updated correctly.

**Tech Stack:**
- PowerShell for file discovery and batch manipulation.
- Python for complex regex replacements if needed.

---

### Task 1: Rebrand README.md, AGENTS.md, SECURITY.md, and CONTRIBUTING.md

**Files:**
- Modify: `D:\School\PROJECT\anakot-agent\README.md`
- Modify: `D:\School\PROJECT\anakot-agent\AGENTS.md`
- Modify: `D:\School\PROJECT\anakot-agent\SECURITY.md`
- Modify: `D:\School\PROJECT\anakot-agent\CONTRIBUTING.md`

**Step 1: Replace branding strings**
- Replace "Anakot Agent" with "Anakot Agent"
- Replace "anakot-agent" with "anakot-agent"
- Replace "Anakot" with "Anakot" (in branding context)
- Replace "anakot" command with "anakot" command in user instructions.
- Replace `~/.anakot` with `~/.anakot`

**Step 2: Remove "Contributors" or "Credits" sections**
- Search for headers like `## Contributors` or `## Credits` and remove the entire section.

**Step 3: Commit**
```bash
git add README.md AGENTS.md SECURITY.md CONTRIBUTING.md
git commit -m "docs: rebrand core markdown files to Anakot"
```

### Task 2: Batch Rebrand all other .md files

**Files:**
- Modify: All `.md` files in `D:\School\PROJECT\anakot-agent` (excluding `.venv` and already modified files).

**Step 1: Perform branding replacements**
- Use regex to replace branding strings and user instructions.
- Ensure internal file paths like `anakot_cli/` and function names like `get_anakot_home()` are preserved.
- Target patterns:
    - `Anakot Agent` -> `Anakot Agent`
    - `anakot-agent` -> `anakot-agent`
    - `~/.anakot` -> `~/.anakot`
    - ``anakot `` (at start of line or in backticks) -> ``anakot ``

**Step 2: Commit**
```bash
git add .
git commit -m "docs: batch rebrand remaining markdown files"
```

### Task 3: Update Branding URLs

**Files:**
- Modify: All `.md` files in `D:\School\PROJECT\anakot-agent`.

**Step 1: Update URLs**
- Replace `anakot-agent.callmemo.ai` with `anakot-agent.callmemo.ai` (assuming this is the new docs URL).
- Replace `github.com/callmemo/anakot-agent` with `github.com/callmemo/anakot-agent` if it fits the branding logic.

**Step 2: Commit**
```bash
git add .
git commit -m "docs: update branding URLs to Anakot"
```

### Task 4: Final Verification

**Step 1: Check for remaining "Anakot" or "anakot" occurrences**
Run: `grep -r "[Hh]ermes" --include="*.md" .`
Verify hits are strictly internal (paths, identifiers).

**Step 2: Verify specific file cleanup**
Ensure "Contributors" and "Credits" sections are gone from the 4 main files.
