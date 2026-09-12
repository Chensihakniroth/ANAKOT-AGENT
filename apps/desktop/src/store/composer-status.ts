// Composer status tracking — what state each session's composer is in.
// Drives the status bar indicator per session.

import { atom } from 'nanostores'

export type ComposerStatus = 'idle' | 'streaming' | 'awaiting' | 'error'

export const $composerStatus = atom<Record<string, ComposerStatus>>({})

export function setComposerStatus(sessionId: string, status: ComposerStatus): void {
  $composerStatus.set({ ...$composerStatus.get(), [sessionId]: status })
}

export function getComposerStatus(sessionId: string): ComposerStatus {
  return $composerStatus.get()[sessionId] ?? 'idle'
}

export function clearComposerStatus(sessionId: string): void {
  const next = { ...$composerStatus.get() }
  delete next[sessionId]
  $composerStatus.set(next)
}
