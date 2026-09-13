import { persistentAtom } from '@/lib/persisted'
import { $sessions } from './session'
import { $activeSessionId } from './session'
// Session unread — full port from Hermes
export const $unreadFinishedSessionIds = persistentAtom<Set<string>>(
  'anakot.desktop.unread-finished',
  new Set(),
  { decode: (raw) => new Set(JSON.parse(raw)), encode: (v) => JSON.stringify([...v]) }
)
export function markSessionUnreadFinished(sessionId: string) {
  const next = new Set($unreadFinishedSessionIds.get())
  next.add(sessionId)
  $unreadFinishedSessionIds.set(next)
}
export function clearSessionUnreadFinished(sessionId: string) {
  const next = new Set($unreadFinishedSessionIds.get())
  next.delete(sessionId)
  $unreadFinishedSessionIds.set(next)
}
export function isSessionUnread(sessionId: string): boolean {
  const session = $sessions.get().find(s => s.id === sessionId)
  if (!session) return false
  return $unreadFinishedSessionIds.get().has(sessionId) || (session.message_count ?? 0) > 0
}
export function ackStoredSessionId(sessionId: string) {
  clearSessionUnreadFinished(sessionId)
}
export function getUnreadCount(): number {
  return $unreadFinishedSessionIds.get().size
}