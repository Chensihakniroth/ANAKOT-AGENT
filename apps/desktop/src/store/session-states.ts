import { atom } from 'nanostores'
// Session states — ported from Hermes
// Tracks per-session runtime state
export const $sessionStates = atom<Record<string, string>>({})
export function setSessionState(sessionId: string, state: string) {
  $sessionStates.set({ ...$sessionStates.get(), [sessionId]: state })
}
export function getSessionState(sessionId: string): string | undefined {
  return $sessionStates.get()[sessionId]
}