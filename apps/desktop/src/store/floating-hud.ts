import { atom } from 'nanostores'

// Floating HUD — ported from Hermes, compact always-on-top quick actions
export interface FloatingHudState {
  visible: boolean
  sessionId: string | null
  pinned: boolean
}

export const $floatingHudState = atom<FloatingHudState>({
  visible: false,
  sessionId: null,
  pinned: false,
})
export const $floatingHudVisible = atom(false)

export function toggleFloatingHud() {
  $floatingHudVisible.set(!$floatingHudVisible.get())
}

export function showFloatingHud(sessionId?: string) {
  $floatingHudVisible.set(true)
  if (sessionId) {
    $floatingHudState.set({ visible: true, sessionId, pinned: false })
  }
}

export function hideFloatingHud() {
  $floatingHudVisible.set(false)
}

export function pinFloatingHud() {
  const state = $floatingHudState.get()
  $floatingHudState.set({ ...state, pinned: !state.pinned })
}

export function setHudSession(sessionId: string | null) {
  $floatingHudState.set({ ...$floatingHudState.get(), sessionId })
}

export function getFloatingHudState(): FloatingHudState {
  return $floatingHudState.get()
}
