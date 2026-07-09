import { atom } from 'nanostores'

// ── Types ────────────────────────────────────────────────────────────────────

export type TerminalCursorStyle = 'bar' | 'block' | 'underline'

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  cursorStyle: TerminalCursorStyle
  cursorBlink: boolean
  scrollback: number
  letterSpacing: number
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const TERMINAL_DEFAULTS: Readonly<TerminalSettings> = {
  fontFamily: "'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'Cascadia Code', 'JetBrains Mono', monospace",
  fontSize: 11,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 1000,
  letterSpacing: 0
}

// ── Curated font list ────────────────────────────────────────────────────────

export const TERMINAL_FONT_OPTIONS = [
  { label: 'JetBrainsMono Nerd Font', value: "'JetBrainsMono Nerd Font', monospace" },
  { label: 'FiraCode Nerd Font', value: "'FiraCode Nerd Font', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { label: 'SF Mono', value: "'SF Mono', monospace" },
  { label: 'Menlo', value: "'Menlo', monospace" },
  { label: 'Consolas', value: "'Consolas', monospace" },
  { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { label: 'Ubuntu Mono', value: "'Ubuntu Mono', monospace" },
  { label: 'monospace', value: 'monospace' },
] as const

// ── Persistence key ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'anakot-terminal-settings'

function loadFromStorage(): TerminalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...TERMINAL_DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...TERMINAL_DEFAULTS, ...parsed }
  } catch {
    return { ...TERMINAL_DEFAULTS }
  }
}

function saveToStorage(settings: TerminalSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

// ── Atom ─────────────────────────────────────────────────────────────────────

export const $terminalSettings = atom<TerminalSettings>(loadFromStorage())

// ── Mutators ─────────────────────────────────────────────────────────────────

export function setTerminalSetting<K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) {
  const next = { ...$terminalSettings.get(), [key]: value }
  $terminalSettings.set(next)
  saveToStorage(next)
}

export function resetTerminalSettings() {
  const defaults = { ...TERMINAL_DEFAULTS }
  $terminalSettings.set(defaults)
  saveToStorage(defaults)
}
