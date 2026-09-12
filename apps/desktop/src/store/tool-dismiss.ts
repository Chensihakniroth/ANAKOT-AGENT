// Tool dismissal state — tracks which tool result rows the user has locally
// hidden via a dismiss control. View-only: underlying tool call still lives in
// stored chat history; dismissed rows stop sitting at the tail of the conversation.
//
// Memory-only (not localStorage): the thread is virtualized, so a dismissed row's
// component unmounts and remounts as it scrolls. Component-local state would forget
// the dismissal and the row would pop back. Module memory survives those remounts
// for the life of the app session.

import { atom, computed, type ReadableAtom } from 'nanostores'

type DismissedToolRows = Record<string, true>

export const $dismissedToolRows = atom<DismissedToolRows>({})

const dismissedCache = new Map<string, ReadableAtom<boolean>>()

/** Returns a per-row atom that reads whether `id` is dismissed. */
export function $toolRowDismissed(id: string): ReadableAtom<boolean> {
  let c = dismissedCache.get(id)
  if (!c) {
    c = computed($dismissedToolRows, rows => !!rows[id])
    dismissedCache.set(id, c)
  }
  return c
}

/** Mark a tool result row as dismissed. */
export function dismissToolRow(id: string): void {
  const rows = $dismissedToolRows.get()
  if (rows[id]) return
  $dismissedToolRows.set({ ...rows, [id]: true })
}

/** Restore a dismissed tool result row. */
export function undismissToolRow(id: string): void {
  const rows = $dismissedToolRows.get()
  if (!rows[id]) return
  const next = { ...rows }
  delete next[id]
  $dismissedToolRows.set(next)
}

/** Clear a dismissed tool result row. */
export function clearDismissedToolRow(id: string): void {
  const rows = $dismissedToolRows.get()
  if (!rows[id]) return
  const next = { ...rows }
  delete next[id]
  $dismissedToolRows.set(next)
}
