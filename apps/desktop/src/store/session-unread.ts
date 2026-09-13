import { atom } from 'nanostores'
// Session unread tracking — ported from Hermes
export const $unreadFinishedSessionIds = atom<Set<string>>(new Set())
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