// HUD state — visibility + mode for the heads-up display overlay.
// HUD can be a glass panel, game overlay, or transcript band.

import { atom } from 'nanostores'

export type HudMode = 'glass' | 'game-overlay' | 'transcript-band' | null

export const $hudVisible = atom(false)
export const $hudMode = atom<HudMode>(null)

export function showHud(mode: HudMode = 'glass'): void {
  $hudMode.set(mode)
  $hudVisible.set(true)
}

export function hideHud(): void {
  $hudVisible.set(false)
}

export function toggleHud(mode: HudMode = 'glass'): void {
  if ($hudVisible.get() && $hudMode.get() === mode) {
    hideHud()
  } else {
    showHud(mode)
  }
}
