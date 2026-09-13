import { atom, computed } from 'nanostores'
import { $sessions } from './session'
import { $activeSessionId } from './session'
// Session states — full port from Hermes
export interface SessionState {
  sessionId: string
  status: 'idle' | 'busy' | 'error' | 'gone'
  busy: boolean
  awaitingResponse: boolean
  lastActivity: number
}
export const $sessionStates = atom<Record<string, SessionState>>({})
export const $activeSessionState = computed(
  [$sessionStates, $activeSessionId],
  (states, activeId) => activeId ? states[activeId] : undefined
)
export function updateSessionState(sessionId: string, patch: Partial<SessionState>) {
  const current = $sessionStates.get()
  $sessionStates.set({ ...current, [sessionId]: { ...current[sessionId], sessionId, ...patch } })
}
export function isSessionGone(sessionId: string): boolean {
  return $sessionStates.get()[sessionId]?.status === 'gone'
}
export function isSessionGoneForBackgroundPolling(sessionId: string): boolean {
  return isSessionGone(sessionId)
}
export function markSessionGone(sessionId: string) {
  updateSessionState(sessionId, { status: 'gone' })
}
export function isBusy(sessionId?: string): boolean {
  const id = sessionId ?? $activeSessionId.get()
  return id ? $sessionStates.get()[id]?.busy ?? false : false
}
export function setBusy(busy: boolean, sessionId?: string) {
  const id = sessionId ?? $activeSessionId.get()
  if (id) updateSessionState(id, { busy })
}
export function setAwaitingResponse(awaiting: boolean, sessionId?: string) {
  const id = sessionId ?? $activeSessionId.get()
  if (id) updateSessionState(id, { awaitingResponse: awaiting })
}