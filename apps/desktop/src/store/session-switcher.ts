import { atom } from 'nanostores'

export const $switcherOpen = atom(false)
export const $switcherIndex = atom(0)

export function openSwitcher(): void {
  $switcherIndex.set(0)
  $switcherOpen.set(true)
}

export function closeSwitcher(): void {
  $switcherOpen.set(false)
}

export function toggleSwitcher(): void {
  if ($switcherOpen.get()) {
    closeSwitcher()
  } else {
    openSwitcher()
  }
}

export function moveSwitcherIndex(delta: number, max: number): void {
  const current = $switcherIndex.get()
  const next = current + delta
  if (next >= 0 && next < max) {
    $switcherIndex.set(next)
  }
}

export function setSwitcherIndex(index: number): void {
  $switcherIndex.set(index)
}
