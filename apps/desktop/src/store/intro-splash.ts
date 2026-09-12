// Intro splash — first-run splash screen.

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.introSplash.seen'

export const $introSplashSeen = atom(storedBoolean(STORAGE_KEY, false))

export function markIntroSplashSeen(): void {
  $introSplashSeen.set(true)
  persistBoolean(STORAGE_KEY, true)
}

export function shouldShowIntroSplash(): boolean {
  return !$introSplashSeen.get()
}
