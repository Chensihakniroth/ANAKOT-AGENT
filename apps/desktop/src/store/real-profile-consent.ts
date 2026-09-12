// Real profile consent — one-time consent prompt for real-profile browsing.
// Shown when a Browser pane opens while browser.use_real_profile is off.

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.real-profile-prompt-dismissed'

export const $realProfilePromptDismissed = atom(storedBoolean(STORAGE_KEY, false))
$realProfilePromptDismissed.subscribe(d => persistBoolean(STORAGE_KEY, d))

export const $realProfilePromptMuted = atom(false)
export const $realProfilePromptClaim = atom<null | string>(null)

export function claimRealProfilePrompt(id: string): void {
  if ($realProfilePromptClaim.get() === null) $realProfilePromptClaim.set(id)
}

export function releaseRealProfilePrompt(id: string): void {
  if ($realProfilePromptClaim.get() === id) $realProfilePromptClaim.set(null)
}
