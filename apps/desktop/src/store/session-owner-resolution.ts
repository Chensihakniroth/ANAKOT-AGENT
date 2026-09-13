import { atom } from 'nanostores'
// Session owner resolution — full port from Hermes
export class SessionOwnerResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionOwnerResolutionError'
  }
}
export function isSessionOwnerResolutionError(error: unknown): error is SessionOwnerResolutionError {
  return error instanceof SessionOwnerResolutionError
}
export interface SessionOwnerResolution {
  sessionId: string
  ownerId: string | null
  profile: string | null
  connectionId: string | null
}
export const $sessionOwnerResolutions = atom<Record<string, SessionOwnerResolution>>({})
export function resolveSessionOwner(sessionId: string): SessionOwnerResolution | null {
  return $sessionOwnerResolutions.get()[sessionId] ?? null
}
export function setSessionOwnerResolution(sessionId: string, resolution: SessionOwnerResolution) {
  $sessionOwnerResolutions.set({ ...$sessionOwnerResolutions.get(), [sessionId]: resolution })
}
export function assertSessionOwnerResolved(sessionId: string): SessionOwnerResolution {
  const resolution = resolveSessionOwner(sessionId)
  if (!resolution) {
    throw new SessionOwnerResolutionError(`Cannot resolve owner for session ${sessionId}`)
  }
  return resolution
}