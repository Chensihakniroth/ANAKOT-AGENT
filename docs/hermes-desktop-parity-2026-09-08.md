# Hermes Desktop Parity

This note records the desktop parity work against `NousResearch/hermes-agent`
main at `fef0e16fe19b79ded929209f87c7434270b03825` (release `v0.21.1`,
`v2026.9.7`). Anakot is a fork, but its backend and product identity are no
longer identical to Hermes, so parity is implemented by feature contract rather
than by replacing the whole `apps/desktop` tree.

## Implemented in Anakot

- Global find-in-page state, keyboard handling, native Chromium search, match
  counts, and a shell-level find bar.
- Device-local keep-awake preference backed by Electron's
  `powerSaveBlocker`.
- Completion sound preference and a lightweight opt-out completion cue when the
  active chat turn finishes.
- Wake-word controls, backend status, and shell-level listening/detection
  feedback using the existing `wake.*` gateway contract.
- Webhooks settings with create, event filters, delivery target, enable/disable,
  delete, refresh, URL copy, and one-time secret display.
- Keyboard session switching with Ctrl/Cmd+Tab and Ctrl/Cmd+Shift+Tab.
- Keep-awake and completion-sound controls in desktop settings.
- Existing Anakot ports verified locally: projects/worktrees, Quick Entry,
  reactions, terminal settings, window opacity, profiles, NotebookLLM, and
  Discord Rich Presence.

## Requires Backend Work First

These upstream Hermes features should not be copied into the renderer until the
matching Anakot contracts exist:

- Native wake indicator window lifecycle (the backend controls and shell pill
  are implemented; the separate always-on-top indicator remains).
- Session import: foreign transcript discovery, upload, conversion, and
  persistence APIs.
- Webhooks: the core Anakot REST CRUD surface is now wired into settings;
  profile-scoped remote routing and restart orchestration remain.
- Hermes connection fleet and retained remote-session ownership model.
- Managed local-model runtime and provider wait state.
- Learning journey UI actions that currently exceed Anakot's Starmap API.

## Validation

`npm run type-check --prefix apps/desktop` passes after the parity slice.

The Electron platform suite passes 98/98 after fixing three pre-existing
failures in `bootstrap-platform.test.cjs` and `hardening.test.cjs` (bare
`require('child_process')` in main.cjs and dropped `.env` blocking in
hardening.cjs).
