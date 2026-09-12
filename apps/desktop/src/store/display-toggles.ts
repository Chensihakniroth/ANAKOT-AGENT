// Display toggle preferences — what chrome elements are visible.
// Persisted per-window.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.display-toggles'

export interface DisplayToggles {
  timestamps: boolean
  userBubbleTransparency: boolean
  sidebarArchive: boolean
  statusbar: boolean
  tabstrip: boolean
}

const DEFAULTS: DisplayToggles = {
  timestamps: true,
  userBubbleTransparency: false,
  sidebarArchive: false,
  statusbar: true,
  tabstrip: true,
}

function load(): DisplayToggles {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return DEFAULTS
  try {
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...(typeof parsed === 'object' && parsed ? parsed : {}) }
  } catch {
    return DEFAULTS
  }
}

export const $displayToggles = atom<DisplayToggles>(load())

$displayToggles.subscribe(value => persistString(STORAGE_KEY, JSON.stringify(value)))

export function setDisplayToggle<K extends keyof DisplayToggles>(key: K, value: DisplayToggles[K]): void {
  $displayToggles.set({ ...$displayToggles.get(), [key]: value })
}
