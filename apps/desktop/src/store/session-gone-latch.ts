// Session gone latch — tracks sessions the gateway has told us are gone.
// A session-scoped RPC against a runtime the gateway no longer holds fails
// 4001 "session not found". Shared by background pollers and owner-routed RPC.

/** Gateway JSON-RPC code for "session not found" */
const GATEWAY_SESSION_NOT_FOUND_CODE = 4001

const goneSessions = new Set<string>()

/** Consecutive heals per stored session id (see runtime-gone.ts) */
export const healsByStoredId = new Map<string, number>()

/** A gone session is unrecoverable for THIS runtime id */
export function isSessionGoneForBackgroundPolling(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'number'
      ? (error as { code: number }).code
      : undefined

  if (code !== undefined) {
    return code === GATEWAY_SESSION_NOT_FOUND_CODE
  }

  const message = (error instanceof Error ? error.message : String(error ?? ''))
    .trim()
    .replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')

  return /^(?:4001\s*[:,-]?\s*)?session not found[.!]?$/i.test(message)
}

export function isSessionGone(sid: null | string | undefined): boolean {
  return Boolean(sid && goneSessions.has(sid))
}

/** Latch `sid` off. Idempotent. */
export function latchSessionGone(sid: string): void {
  if (sid) {
    goneSessions.add(sid)
  }
}

/** Clear the gone-latch */
export function resetBackgroundPollingGuard(sid?: string): void {
  if (sid) {
    goneSessions.delete(sid)
    return
  }

  goneSessions.clear()
  healsByStoredId.clear()
}

function reboundSessionIds(method: string, params: Record<string, unknown>, result: unknown): string[] {
  if (method !== 'session.activate' && method !== 'session.resume') {
    return []
  }

  const ids: string[] = []

  for (const value of [params.session_id, (result as { session_id?: unknown } | null)?.session_id]) {
    if (typeof value === 'string' && value.trim()) {
      ids.push(value.trim())
    }
  }

  return ids
}

/** Un-latch ids a successful session.resume/activate just rebound */
export function resetBackgroundPollingGuardAfterRebind(
  method: string,
  params: Record<string, unknown>,
  result: unknown
): void {
  for (const id of reboundSessionIds(method, params, result)) {
    goneSessions.delete(id)
    healsByStoredId.delete(id)
  }
}
