# Installer Bootstrap Bugs + Dead Directory Cleanup (2026-09-16)

Documented bugs found and fixed in `install-anakot.bat` and the surrounding
installer surface. Source for the `anakot-windows-installer` skill pitfalls.

## Bugs fixed in `install-anakot.bat`

### Unicode box-drawing in cmd.exe

**Symptom**: The banner and "NEXT STEPS" boxes used `┌─┐│└─┘` which mojibaked
under cmd.exe's OEM codepage (437/850), showing as `?` or garbled glyphs.

**Fix**: Replaced with ASCII `+-----+` / `| text |` boxes. The ASCII-art logo at
the very top (block chars like `██╗`) is decorative and tolerated — everything
else is pure ASCII.

### Emoji status markers

**Symptom**: `✘` (fail) and `✔` (ok) used as inline markers. These are outside
the ASCII-safe convention (`+`, `-`, `~`, `>`).

**Fix**: `✘` → `-` (fail), `✔` → `+` (ok), `⚠` → `~` (warn).

### `uv sync --extra all` pulls too much

**Symptom**: `uv sync --extra all --locked` installs `[all]` extras including
`web` (fastapi/uvicorn) and `messaging` (telegram/discord + python-olm, which
needs `make` to build from sdist and fails on Windows).

**Fix**: Use `--extra cron --extra cli --extra pty --extra mcp` for backend+TUI
only. The `uv pip install -e ".[cron,cli,pty,mcp]"` fallback was already correct.

### PATH substring false-positive

**Symptom**: `echo %USER_PATH% | findstr /i "%BIN_DIR%"` matched substrings, so
`C:\Users\Foo\.anakot\backup` would incorrectly match `C:\Users\Foo\.anakot\bin`.

**Fix**: Iterate individual path items with exact `if /i "%%~p"=="%BIN_DIR%"`.

### Fragile sparse-checkout continuations

**Symptom**: `git sparse-checkout set --no-cone ^` with `^` line continuation
breaks silently if any line has trailing whitespace after the caret.

**Fix**: Write patterns to a temp file and pipe via stdin:
```
(echo anakot_cli/ & echo agent/ & ...) > "%TEMP%\sparse-patterns.txt"
git sparse-checkout set --no-cone < "%TEMP%\sparse-patterns.txt"
```

### No install manifest

**Symptom**: Re-runs couldn't detect existing installs intelligently.

**Fix**: Write `~/.anakot/.install_manifest` after clone with `dir=`, `branch=`,
`commit=`, `timestamp=` lines (mirrors install.sh/install.ps1).

### No long-path check

**Symptom**: The 260-char Windows path limit breaks npm install deep in
`node_modules` with no warning.

**Fix**: Query `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled`
and warn if not `0x1`, with a link to the Microsoft docs.

## Dead `installers/` directory

An `installers/` directory at the repo root contained 6 files that were never
imported by CI, the Tauri installer, or any build script:

- `install-anakot.bat` — banner incorrectly said "Desktop GUI"
- `install-anakot.ps1` — 655-line stub vs the real 3058-line `scripts/install.ps1`
- `install-anakot.sh` — duplicate of `scripts/install.sh`
- `repair-anakot.bat`, `uninstall-anakot.bat`, `update-anakot.bat` — duplicates
  of root-level files

Only reference was in `docs/_anakot_only_files.txt` (a documentation listing).

**Fix**: Removed the entire directory via `git rm -r installers/` and cleaned up
the docs list. Canonical entry points are now:

- `scripts/install.ps1` (Windows — used by Tauri + `irm|iex`)
- `scripts/install.sh` (Linux/macOS)
- `scripts/install.cmd` (Windows CMD wrapper)
- `install-anakot.bat` (root — standalone double-click launcher)

## `estimated_duration_ms` manifest field

Added per-stage wall-clock estimates to `scripts/install.ps1`'s `-Manifest`
output so UIs can show time-remaining. Additive — does not bump
`$InstallStageProtocolVersion`. Covered by the stage-protocol smoke test.
