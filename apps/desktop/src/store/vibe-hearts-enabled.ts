// Vibe hearts toggle — synthetic decorative heart particles that float up
// from the chat during conversations. Purely cosmetic, no functional impact.

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.vibe-hearts.enabled'

export const $vibeHeartsEnabled = atom(storedBoolean(STORAGE_KEY, false))

$vibeHeartsEnabled.subscribe(value => persistBoolean(STORAGE_KEY, value))

export function setVibeHeartsEnabled(enabled: boolean): void {
  $vibeHeartsEnabled.set(enabled)
}

export function toggleVibeHearts(): void {
  $vibeHeartsEnabled.set(!$vibeHeartsEnabled.get())
}
