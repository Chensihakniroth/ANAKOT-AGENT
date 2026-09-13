import { atom } from 'nanostores'
// Session project label — ported from Hermes
export function getProjectLabel(sessionId: string): string {
  return sessionId.slice(0, 8)
}