import { atom } from 'nanostores'
// TTS lease — ported from Hermes
export const $ttsLease = atom<{ leased: boolean; sessionId?: string }>({ leased: false })
export function acquireTtsLease(sessionId: string): boolean {
  if ($ttsLease.get().leased) return false
  $ttsLease.set({ leased: true, sessionId })
  return true
}
export function releaseTtsLease() {
  $ttsLease.set({ leased: false })
}