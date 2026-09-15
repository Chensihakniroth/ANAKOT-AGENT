import { atom, computed } from 'nanostores'

// Session picker overlay state — ported from Hermes
export const $sessionPickerOpen = atom(false)
export const $sessionPickerQuery = atom('')
export const $sessionPickerIndex = atom(0)

export function openSessionPicker() {
  $sessionPickerOpen.set(true)
  $sessionPickerQuery.set('')
  $sessionPickerIndex.set(0)
}

export function closeSessionPicker() {
  $sessionPickerOpen.set(false)
  $sessionPickerQuery.set('')
  $sessionPickerIndex.set(0)
}

export function setSessionPickerQuery(query: string) {
  $sessionPickerQuery.set(query)
  $sessionPickerIndex.set(0) // Reset selection on query change
}

export function moveSessionPickerIndex(delta: number, max: number) {
  const current = $sessionPickerIndex.get()
  const next = current + delta
  if (next >= 0 && next < max) {
    $sessionPickerIndex.set(next)
  }
}

export function getSessionPickerState() {
  return {
    open: $sessionPickerOpen.get(),
    query: $sessionPickerQuery.get(),
    index: $sessionPickerIndex.get(),
  }
}
