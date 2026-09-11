import { atom } from 'nanostores'

export const $sessionPickerOpen = atom(false)

export function openSessionPicker(): void {
  $sessionPickerOpen.set(true)
}

export function closeSessionPicker(): void {
  $sessionPickerOpen.set(false)
}

export function toggleSessionPicker(): void {
  if ($sessionPickerOpen.get()) {
    closeSessionPicker()
  } else {
    openSessionPicker()
  }
}
