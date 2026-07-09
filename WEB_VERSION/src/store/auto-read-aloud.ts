// Auto-read-aloud toggle for the desktop composer.
// When enabled, assistant replies are automatically spoken aloud via TTS.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.auto-read-aloud'

export const $autoReadAloud = atom<boolean>(storedString(STORAGE_KEY) === 'true')

$autoReadAloud.subscribe(value => {
  persistString(STORAGE_KEY, value ? 'true' : 'false')
})

export function toggleAutoReadAloud(): void {
  $autoReadAloud.set(!$autoReadAloud.get())
}
