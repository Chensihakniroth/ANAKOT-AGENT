// Window translucency — opacity slider for the main window.
// Applied via Electron IPC on change.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.translucency'

export interface TranslucencyState {
  enabled: boolean
  opacity: number // 0.5 – 1.0
}

const DEFAULTS: TranslucencyState = { enabled: false, opacity: 1.0 }

function load(): TranslucencyState {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return DEFAULTS
  try {
    const parsed = JSON.parse(raw)
    return {
      enabled: Boolean(parsed?.enabled),
      opacity: typeof parsed?.opacity === 'number' ? Math.min(1, Math.max(0.5, parsed.opacity)) : 1.0,
    }
  } catch {
    return DEFAULTS
  }
}

export const $translucency = atom<TranslucencyState>(load())

$translucency.subscribe(value => persistString(STORAGE_KEY, JSON.stringify(value)))

export function setTranslucencyEnabled(enabled: boolean): void {
  $translucency.set({ ...$translucency.get(), enabled })
}

export function setTranslucencyOpacity(opacity: number): void {
  const clamped = Math.min(1, Math.max(0.5, opacity))
  $translucency.set({ ...$translucency.get(), opacity: clamped })
}
