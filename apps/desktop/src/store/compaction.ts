// Per-session auto-compaction indicator.
// While compaction runs mid-turn, the transcript looks like it reset.
// Per-session so a background chat can never clobber the foreground view.

import { atom, computed } from 'nanostores'

const keyFor = (sessionId: string | null | undefined): string => sessionId ?? ''

export const $compactingSessions = atom<Record<string, true>>({})

/** Is `sessionId` compacting? Per-session because a transcript may be a tile. */
export function sessionCompacting(sessionId: null | string) {
  return computed($compactingSessions, sessions => keyFor(sessionId) in sessions)
}

export function setSessionCompacting(sessionId: string | null | undefined, active: boolean): void {
  const key = keyFor(sessionId)
  const sessions = $compactingSessions.get()

  if (active) {
    if (key in sessions) return
    $compactingSessions.set({ ...sessions, [key]: true })
    return
  }

  if (!(key in sessions)) return
  const next = { ...sessions }
  delete next[key]
  $compactingSessions.set(next)
}
