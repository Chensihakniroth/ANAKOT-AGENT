// Statusbar preferences — whole-bar visibility toggle + hidden statusbar items.
// Inspired by VS Code's `workbench.statusBar.visible`.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const VISIBLE_STORAGE_KEY = 'anakot.desktop.statusbarVisible.v2'
const HIDDEN_STORAGE_KEY = 'anakot.desktop.statusbarHidden.v2'

export interface StatusbarPrefsState {
  visible: boolean // whole bar on/off
  hiddenItems: Array<string> // item ids hidden by user
}

function loadHidden(): string[] {
  const raw = storedString(HIDDEN_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

export const $statusbarPrefs = atom<StatusbarPrefsState>({
  visible: true,
  hiddenItems: loadHidden(),
})

$statusbarPrefs.subscribe(value => persistString(VISIBLE_STORAGE_KEY, JSON.stringify(value)))

export function setStatusbarVisible(visible: boolean): void {
  $statusbarPrefs.set({ ...$statusbarPrefs.get(), visible })
}

export function toggleStatusbarItem(itemId: string): void {
  const prefs = $statusbarPrefs.get()
  const hidden = prefs.hiddenItems.filter(id => id !== itemId)
  $statusbarPrefs.set({
    ...prefs,
    hiddenItems: hidden.includes(itemId) ? [...hidden, itemId] : [...hidden],
  })
}

export function isStatusbarItemVisible(itemId: string): boolean {
  return $statusbarPrefs.get().visible && !$statusbarPrefs.get().hiddenItems.includes(itemId)
}

export function resetStatusbarPrefs(): void {
  $statusbarPrefs.set({ visible: true, hiddenItems: [] })
}
