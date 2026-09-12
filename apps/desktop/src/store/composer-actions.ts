'use client'

import { atom } from 'nanostores'

/** Composer micro actions — the floating pill strip at the top of the composer's overlay lane.
 * A badge is a label and a `run`; what it does is entirely the registrar's business.
 * Session-scoped like every other stack feed.
 */
export interface ComposerAction {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  run: (sessionId: string) => Promise<void> | void
}

export const $composerActionsBySession = atom<Record<string, ComposerAction[]>>({})

export function setComposerActions(sessionId: string, actions: ComposerAction[]): void {
  $composerActionsBySession.set({ ...$composerActionsBySession.get(), [sessionId]: actions })
}

export function appendComposerAction(sessionId: string, action: ComposerAction): void {
  const current = $composerActionsBySession.get()
  const existing = current[sessionId] ?? []
  if (existing.some(a => a.id === action.id)) return
  $composerActionsBySession.set({ ...current, [sessionId]: [...existing, action] })
}

export function removeComposerAction(sessionId: string, actionId: string): void {
  const current = $composerActionsBySession.get()
  $composerActionsBySession.set({
    ...current,
    [sessionId]: (current[sessionId] ?? []).filter(a => a.id !== actionId),
  })
}

export function clearComposerActions(sessionId: string): void {
  const next = { ...$composerActionsBySession.get() }
  delete next[sessionId]
  $composerActionsBySession.set(next)
}
