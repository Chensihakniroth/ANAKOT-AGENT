import { atom } from 'nanostores'
// Floating HUD — ported from Hermes
export interface FloatingHudState { visible: boolean; sessionId: string | null }
export const $floatingHudState = atom<FloatingHudState>({ visible: false, sessionId: null })
export const $floatingHudVisible = atom(false)

export function toggleFloatingHud() {
  $floatingHudVisible.set(!$floatingHudVisible.get())
}

export function showFloatingHud(sessionId?: string) {
  $floatingHudVisible.set(true)
  if (sessionId) $floatingHudState.set({ visible: true, sessionId })
}

export function hideFloatingHud() {
  $floatingHudVisible.set(false)
}

export function getFloatingHudState(): FloatingHudState { return $floatingHudState.get() }
