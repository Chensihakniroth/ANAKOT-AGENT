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
- Existing Anakot ports verified locally: projects/worktrees, Quick Entry,
  reactions, terminal settings, window opacity, profiles, NotebookLLM, and
  Discord Rich Presence.

## Requires Backend Work First

These upstream Hermes features should not be copied into the renderer until the
matching Anakot contracts exist:

- Wake indicator: `wake.start`, `wake.stop`, `wake.status`, and the native
  indicator window lifecycle.
- Session import: foreign transcript discovery, upload, conversion, and
  persistence APIs.
- Webhooks: webhook CRUD, enable/restart responses, delivery routes, and
  profile-scoped RPC/API methods.
- Hermes connection fleet and retained remote-session ownership model.
- Managed local-model runtime and provider wait state.
- Learning journey UI actions that currently exceed Anakot's Starmap API.

## Validation

`npm run type-check --prefix apps/desktop` passes after the parity slice.

The existing Electron platform suite still reports three pre-existing failures
in `bootstrap-platform.test.cjs` and `hardening.test.cjs`; they concern the
unpackaged `child_process` scan and sensitive-file expectations, not the new
desktop contracts.
