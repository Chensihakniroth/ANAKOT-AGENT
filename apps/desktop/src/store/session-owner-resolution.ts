import { atom } from 'nanostores'

// Session owner resolution — stub for read-only transcript recovery.
// Full implementation tracks session ownership and resolves which backend
// owns a given session id. See Hermes session-owner-resolution.ts.

export class SessionOwnerResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionOwnerResolutionError'
  }
}

export function isSessionOwnerResolutionError(error: unknown): error is SessionOwnerResolutionError {
  return error instanceof SessionOwnerResolutionError
}
