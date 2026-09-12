// Backdrop toggle — controls whether the faint statue image renders behind
// the chat transcript (decorative only, no functional impact).

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.backdrop.enabled'

export const $backdropEnabled = atom(storedBoolean(STORAGE_KEY, false))

$backdropEnabled.subscribe(value => persistBoolean(STORAGE_KEY, value))

export function setBackdropEnabled(enabled: boolean): void {
  $backdropEnabled.set(enabled)
}

export function toggleBackdrop(): void {
  $backdropEnabled.set(!$backdropEnabled.get())
}
