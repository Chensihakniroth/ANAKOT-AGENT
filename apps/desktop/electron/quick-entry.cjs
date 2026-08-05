/**
 * Quick Entry — the global-hotkey mini composer.
 *
 * A small frameless always-on-top window that a global shortcut summons from
 * anywhere so the user can fire a prompt at Anakot without raising the whole
 * app. The window carries NO gateway connection of its own: it forwards the
 * text to the primary renderer, which sends it through the SAME prompt-submit
 * path the normal composer uses (see store/quick-entry + the bridge hook).
 *
 * Everything Electron-free lives here so the parts that actually break a user —
 * accelerator validation, "disabled means never register", and surfacing a
 * shortcut another app already owns — are unit-testable without booting
 * Electron. main.cjs owns the BrowserWindow, the file I/O, and the real
 * `globalShortcut`.
 *
 * Ported from Hermes Agent (apps/desktop/electron/quick-entry.ts), renames
 * hermes→anakot applied; CJS-ified.
 */

// Default matches the muscle memory of the apps this ports from (Claude
// Desktop's quick entry / ChatGPT's Quick Chat sit on a Cmd+Shift chord).
const DEFAULT_QUICK_ENTRY_SHORTCUT = 'CommandOrControl+Shift+Space'

// Compact capture surface: wide enough for a sentence, short enough to read as
// a HUD rather than a second app window. Height covers the composer row plus
// the session-target picker row; the renderer never grows the OS window in v1.
const QUICK_ENTRY_WINDOW_WIDTH = 640
const QUICK_ENTRY_WINDOW_HEIGHT = 168

// Spotlight-ish placement: horizontally centered on the active display, a
// comfortable fraction down from the top rather than dead center.
const QUICK_ENTRY_TOP_FRACTION = 0.22

// Electron accelerator vocabulary (electronjs.org/docs/latest/api/accelerator).
// Kept as data so validation and the settings UI agree on one list.
const ACCELERATOR_MODIFIERS = new Set([
  'alt',
  'altgr',
  'cmd',
  'cmdorctrl',
  'command',
  'commandorcontrol',
  'control',
  'ctrl',
  'meta',
  'option',
  'shift',
  'super'
])

const ACCELERATOR_KEYS = new Set([
  'backspace',
  'delete',
  'down',
  'end',
  'enter',
  'escape',
  'home',
  'insert',
  'left',
  'medianexttrack',
  'mediaplaypause',
  'mediaprevioustrack',
  'mediastop',
  'pagedown',
  'pageup',
  'plus',
  'printscreen',
  'return',
  'right',
  'space',
  'tab',
  'up',
  'volumedown',
  'volumemute',
  'volumeup'
])

// Single printable characters Electron accepts verbatim, plus 0-9 / A-Z below.
const ACCELERATOR_PUNCTUATION = new Set([
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  ':',
  ';',
  '<',
  '=',
  '>',
  '?',
  '@',
  '[',
  '\\',
  ']',
  '^',
  '_',
  '`',
  '{',
  '|',
  '}',
  '~'
])

function isAcceleratorKey(token) {
  if (ACCELERATOR_KEYS.has(token)) {
    return true
  }

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(token)) {
    return true
  }

  if (/^num(?:[0-9]|lock|dec|add|sub|mult|div)$/.test(token)) {
    return true
  }

  return token.length === 1 && (/^[a-z0-9]$/.test(token) || ACCELERATOR_PUNCTUATION.has(token))
}

/**
 * Validate + normalize a user-typed accelerator.
 *
 * Rules beyond Electron's own grammar, both deliberate:
 * - At least one modifier. A bare global key steals that key from EVERY app.
 * - `Escape` can't be the key: inside the window Escape means "hide", so
 *   binding it globally would make the shortcut un-toggleable.
 */
function parseQuickEntryShortcut(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, reason: 'empty' }
  }

  const parts = raw
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { ok: false, reason: 'empty' }
  }

  const modifiers = []
  let key = null

  for (const part of parts) {
    const lower = part.toLowerCase()

    if (ACCELERATOR_MODIFIERS.has(lower)) {
      if (key) {
        // A modifier after the key ("A+Shift") is not a valid accelerator.
        return { ok: false, reason: 'invalid-modifier' }
      }

      modifiers.push(lower)

      continue
    }

    if (key) {
      // Two non-modifier keys ("Shift+A+B").
      return { ok: false, reason: 'invalid-key' }
    }

    if (!isAcceleratorKey(lower)) {
      return { ok: false, reason: 'invalid-key' }
    }

    key = lower
  }

  if (!key) {
    return { ok: false, reason: 'no-key' }
  }

  if (modifiers.length === 0) {
    return { ok: false, reason: 'no-modifier' }
  }

  if (key === 'escape') {
    return { ok: false, reason: 'reserved' }
  }

  // Canonical casing so a saved shortcut round-trips identically no matter how
  // the user typed it, and duplicate modifiers collapse.
  const seen = new Set()

  const normalizedModifiers = modifiers
    .map(modifier => CANONICAL_MODIFIER[modifier] ?? modifier)
    .filter(modifier => (seen.has(modifier) ? false : (seen.add(modifier), true)))
    // Stable display order (Electron itself is order-insensitive).
    .sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))

  return { accelerator: [...normalizedModifiers, canonicalKey(key)].join('+'), ok: true }
}

const CANONICAL_MODIFIER = {
  alt: 'Alt',
  altgr: 'AltGr',
  cmd: 'Command',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  commandorcontrol: 'CommandOrControl',
  control: 'Control',
  ctrl: 'Control',
  meta: 'Super',
  option: 'Option',
  shift: 'Shift',
  super: 'Super'
}

const MODIFIER_ORDER = ['CommandOrControl', 'Command', 'Control', 'Super', 'Alt', 'Option', 'AltGr', 'Shift']

const CANONICAL_KEY = {
  backspace: 'Backspace',
  delete: 'Delete',
  down: 'Down',
  end: 'End',
  enter: 'Enter',
  escape: 'Escape',
  home: 'Home',
  insert: 'Insert',
  medianexttrack: 'MediaNextTrack',
  mediaplaypause: 'MediaPlayPause',
  mediaprevioustrack: 'MediaPreviousTrack',
  mediastop: 'MediaStop',
  pagedown: 'PageDown',
  pageup: 'PageUp',
  plus: 'Plus',
  printscreen: 'PrintScreen',
  return: 'Return',
  right: 'Right',
  space: 'Space',
  tab: 'Tab',
  up: 'Up',
  volumedown: 'VolumeDown',
  volumemute: 'VolumeMute',
  volumeup: 'VolumeUp',
  left: 'Left'
}

function canonicalKey(key) {
  if (CANONICAL_KEY[key]) {
    return CANONICAL_KEY[key]
  }

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return key.toUpperCase()
  }

  if (key.length === 1 && /^[a-z]$/.test(key)) {
    return key.toUpperCase()
  }

  return key
}

/**
 * Raw persisted JSON → usable settings. A malformed/absent file, or a shortcut
 * that no longer validates (hand-edited, or from a future build), falls back to
 * the default shortcut rather than leaving the feature un-summonable.
 */
function sanitizeQuickEntrySettings(raw) {
  const record = raw && typeof raw === 'object' ? raw : {}
  const parsed = parseQuickEntryShortcut(record.shortcut)

  return {
    // Default ON: the feature is inert until the shortcut is pressed.
    enabled: record.enabled === undefined ? true : record.enabled === true,
    shortcut: parsed.ok ? parsed.accelerator : DEFAULT_QUICK_ENTRY_SHORTCUT
  }
}

/**
 * Owns the one live global accelerator. Single resolver so every caller — boot,
 * the settings write, quit — gets the same answer and we can never leak two
 * registrations for one feature.
 *
 * Disabled settings never touch `register()` at all: a user who turned Quick
 * Entry off must not have their chord silently held hostage.
 */
function createQuickEntryShortcut(globalShortcut, onTrigger) {
  let active = null
  let state = { error: null, registered: false, shortcut: DEFAULT_QUICK_ENTRY_SHORTCUT }

  const release = () => {
    if (active) {
      try {
        globalShortcut.unregister(active)
      } catch {
        // Best effort — a dead accelerator must not block a re-register.
      }

      active = null
    }
  }

  return {
    apply(settings) {
      const parsed = parseQuickEntryShortcut(settings.shortcut)
      const shortcut = parsed.ok ? parsed.accelerator : settings.shortcut

      release()

      if (!settings.enabled) {
        state = { error: null, registered: false, shortcut }

        return state
      }

      if (!parsed.ok) {
        state = { error: 'invalid', registered: false, shortcut }

        return state
      }

      // `isRegistered` catches the common conflict before we ask, and
      // `register()` returning false catches the rest (another process owns it
      // OS-wide). Both land in the same surfaced 'taken' state.
      let ok = false

      try {
        ok = globalShortcut.isRegistered(parsed.accelerator)
          ? false
          : globalShortcut.register(parsed.accelerator, onTrigger)
      } catch {
        ok = false
      }

      active = ok ? parsed.accelerator : null
      state = { error: ok ? null : 'taken', registered: ok, shortcut: parsed.accelerator }

      return state
    },
    current() {
      return state
    },
    dispose() {
      release()
      state = { ...state, error: null, registered: false }
    }
  }
}

/**
 * Where the quick window opens on a given display work area. Centered
 * horizontally, a fraction down from the top, and clamped so it stays fully
 * inside the work area on small/odd displays.
 */
function quickEntryWindowBounds(workArea) {
  const width = Math.min(QUICK_ENTRY_WINDOW_WIDTH, workArea?.width ?? QUICK_ENTRY_WINDOW_WIDTH)
  const height = Math.min(QUICK_ENTRY_WINDOW_HEIGHT, workArea?.height ?? QUICK_ENTRY_WINDOW_HEIGHT)

  if (!workArea) {
    return { height, width, x: 0, y: 0 }
  }

  const x = Math.round(workArea.x + (workArea.width - width) / 2)
  const maxY = workArea.y + workArea.height - height
  const y = Math.round(Math.min(Math.max(workArea.y, workArea.y + workArea.height * QUICK_ENTRY_TOP_FRACTION), maxY))

  return { height, width, x, y }
}

module.exports = {
  DEFAULT_QUICK_ENTRY_SHORTCUT,
  QUICK_ENTRY_TOP_FRACTION,
  QUICK_ENTRY_WINDOW_HEIGHT,
  QUICK_ENTRY_WINDOW_WIDTH,
  createQuickEntryShortcut,
  parseQuickEntryShortcut,
  quickEntryWindowBounds,
  sanitizeQuickEntrySettings
}
