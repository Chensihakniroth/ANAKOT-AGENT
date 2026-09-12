import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const VAULT = 'C:\\Users\\Niroth\\Documents\\ObsidianVault'
const NOTE_PATH = join(VAULT, 'Reverse Engineering', 'Hermes-Anakot Desktop Parity Discovery.md')

const content = `# Hermes Desktop Parity — Discovery Summary

> Method: filename diff first, then grep Anakot source for inline equivalents.
> Only mark "missing" after grep confirms absence. Filename-only diffs lie.

## ✅ Built (85 files, all compile)

### Phases 1-6 (76 files)
- Stores (12): compaction, reasoning-disclosure, model-presets, goals, active-work, display-toggles, translucency, provider-wait, composer-status, composer-suggestions, mcp-deeplink-install, hud
- Lib (15): wake-indicator, desktop-fs, escape-layers, reasoning-blocks, voice-barge-in, session-branch-tree, session-date-groups, transcript-directives, preview-act, preview-annotate, mcp-deeplink, mcp-import, mcp-directory, input-modality, find-in-page
- Components (29): session-picker, idle-mount, tips, onboarding, particles, composer micro-actions/suggestion-pills/voice-menu/undo-history/directive-actions, chat preview-tile/browser-popout/session-drag/session-tile/route-tile/scroll-to-bottom/transcript-backfill/transcript-window/profile-tag, hud-shell/glass/game-overlay/transcript-band/layout/resize-handle/click-through/handoff/thread-focus, wake-indicator
- Settings (6): voice-provider-fields, plugin-install-modal, settings-search, fallback-models-field, memory-settings, ssh-host-selection
- Shell (8): contrib surfaces, composer popout, approval mode, master-detail, file actions, intro splash, context-usage-panel, model-catalog-menu
- Routes (5): webhooks route, contrib routes, command-center verified

### Tier 1 (7 stores)
- backdrop, tool-dismiss, confirm, vibe-hearts-enabled, zoom, statusbar-prefs, sidebar-sort

### Tier 2 (2 components)
- ConfirmHost (wired into app-shell.tsx), ErrorBoundary (wired into app-shell.tsx)
- find-bar.tsx — already exists (mounted in app-shell; filename-only diffs lie)

## ❌ Verified Missing (18 files, grep-proven)

### Lib (2)
- find-in-page-scope.ts
- workspace-themes.ts

### Store (11)
- preview-edit.ts
- preview-status.ts
- preview-open-browser.ts
- real-profile-consent.ts
- provider-collapse.ts
- tabstrip-prefs.ts
- keyboard-only-mode.ts
- session-color.ts
- live-sync.ts
- pane-focus.ts
- pet-generate.ts

### Components (3)
- hint-widget.tsx
- progress-bar.tsx
- debug-inspector.tsx

### Hooks/Lib (1)
- use-stores-selector.tsx

## ⚠️ Skipped (~15, backend/cosmetic)
- send-diagnostics (backend upload)
- session-states + sub-states (backend FSM)
- session-control (backend)
- hub-actions (gateway)
- pet-generate (backend image gen)
- virtual-session-list, row details, gestures (we have equivalents)

---

## Key Lessons

1. **Filename-only diffs lie.** Always grep source before reporting "missing".
2. **Hermes ConfirmHost + ErrorBoundary** were near app-shell — Anakot already had BOTH orbiting app-shell.tsx.
3. **Quick entry** — Hermes had `store/quick-entry.ts`, Anakot already has it + `use-quick-entry-bridge.ts`.
4. **Reactions** — Hermes had `reactions.ts`, `reactions-local.ts`, `reactions-enabled.ts`. All 3 already in Anakot.
5. **Haptics, keep-awake, completion-sound** — all already in Anakot stores despite filename diff suggesting missing.

## Next Steps

The 18 verified-missing files can be built in priority order. Start with:
1. lib/find-in-page-scope.ts (small, wires into existing find-in-page)
2. store/preview-edit.ts + store/preview-status.ts + store/preview-open-browser.ts (preview system)
3. store/keyboard-only-mode.ts (small atom)
4. store/tabstrip-prefs.ts (small atom)
5. store/provider-collapse.ts (small atom)
6. store/session-color.ts (small atom + pick UI)
7. store/pane-focus.ts (small atom)
8. store/live-sync.ts (IPC needed, medium)
9. lib/workspace-themes.ts (small atom)
10. store/real-profile-consent.ts (small atom)
11. hook/use-stores-selector.tsx (hook utility)
12. components/hint-widget.tsx (small component)
13. components/progress-bar.tsx (small component)
14. components/debug-inspector.tsx (medium component)
`
writeFileSync(NOTE_PATH, content)
console.log('Wrote', NOTE_PATH)
`
