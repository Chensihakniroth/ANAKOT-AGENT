import { atom } from 'nanostores'
// Session link title — ported from Hermes
export function getSessionLinkTitle(sessionId: string): string {
  return sessionId.slice(0, 8)
}