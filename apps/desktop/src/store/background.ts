/**
 * Background image store — reactive nanostore for the desktop background image.
 * Persists to localStorage and notifies all subscribers on change.
 */
import { atom } from 'nanostores'

const IMAGE_KEY = 'anakot-desktop-bg-image-v1'
const OPACITY_KEY = 'anakot-desktop-bg-opacity-v1'
const DEFAULT_OPACITY = 0.15

function loadImage(): string | null {
  try {
    return window.localStorage.getItem(IMAGE_KEY) || null
  } catch {
    return null
  }
}

function loadOpacity(): number {
  try {
    const v = window.localStorage.getItem(OPACITY_KEY)
    return v ? parseFloat(v) : DEFAULT_OPACITY
  } catch {
    return DEFAULT_OPACITY
  }
}

export const $backgroundImage = atom<string | null>(loadImage())
export const $backgroundOpacity = atom<number>(loadOpacity())

$backgroundImage.subscribe(img => {
  try {
    if (img) {
      window.localStorage.setItem(IMAGE_KEY, img)
    } else {
      window.localStorage.removeItem(IMAGE_KEY)
    }
  } catch { /* storage full or unavailable */ }
})

$backgroundOpacity.subscribe(op => {
  try {
    window.localStorage.setItem(OPACITY_KEY, String(op))
  } catch { /* ignore */ }
})

export function setBackgroundImage(dataUrl: string | null) {
  $backgroundImage.set(dataUrl)
}

export function setBackgroundOpacity(value: number) {
  $backgroundOpacity.set(value)
}

export function getBackgroundImage(): string | null {
  return $backgroundImage.get()
}

export function getBackgroundOpacity(): number {
  return $backgroundOpacity.get()
}
