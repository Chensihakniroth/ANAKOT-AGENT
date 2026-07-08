/**
 * Custom (installed) themes store.
 *
 * Persists user-installed VS Code themes to localStorage so they survive
 * reloads and appear in the available-themes list alongside built-in skins.
 *
 * Each custom theme has a unique name (prefixed with `vsc:` to avoid
 * collisions with built-in names).  The store is a simple nanostore atom
 * that loads on init and saves on every write.
 */

import { atom } from 'nanostores'

import type { DesktopTheme } from './types'

const STORAGE_KEY = 'anakot-desktop-custom-themes-v1'

function loadThemes(): Record<string, DesktopTheme> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DesktopTheme>) : {}
  } catch {
    return {}
  }
}

function saveThemes(themes: Record<string, DesktopTheme>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(themes))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Reactive atom of custom theme name → DesktopTheme. */
export const $customThemes = atom<Record<string, DesktopTheme>>(loadThemes())

/** Register a new custom theme (replaces any existing one with the same name). */
export function registerCustomTheme(theme: DesktopTheme) {
  const next = { ...$customThemes.get(), [theme.name]: theme }
  $customThemes.set(next)
  saveThemes(next)
}

/** Remove a custom theme by name. */
export function unregisterCustomTheme(name: string) {
  const next = { ...$customThemes.get() }
  delete next[name]
  $customThemes.set(next)
  saveThemes(next)
}

/** Get a single custom theme by name. */
export function getCustomTheme(name: string): DesktopTheme | undefined {
  return $customThemes.get()[name]
}
