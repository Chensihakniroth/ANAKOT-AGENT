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

export function toggleFloatingHud() {
  const state = $floatingHudState.get()
  $floatingHudState.set({ ...state, visible: !state.visible })
}

export function showFloatingHud(sessionId?: string) {
  $floatingHudState.set({ visible: true, sessionId: sessionId ?? null, pinned: false })
}

export function hideFloatingHud() {
  $floatingHudState.set({ ...$floatingHudState.get(), visible: false })
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
