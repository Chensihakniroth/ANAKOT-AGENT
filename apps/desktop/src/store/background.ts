/**
 * Background image store — reactive nanostore for the desktop background image.
 * Persists to localStorage and notifies all subscribers on change.
 *
 * Stored value is always a string URL. Three formats:
 *   - Built-in:  "ds-assets/filler-bg0.jpg"  (relative path, resolved at render)
 *   - Uploaded:  "file:///C:/Users/.../ds-assets/my-bg.png"  (absolute file:// URL)
 *   - Data URL:  "data:image/png;base64,..."  (inline, fallback)
 */
import { atom } from 'nanostores'

const IMAGE_KEY = 'anakot-desktop-bg-image-v1'
const OPACITY_KEY = 'anakot-desktop-bg-opacity-v1'
const POSITION_X_KEY = 'anakot-desktop-bg-position-x-v1'
const POSITION_Y_KEY = 'anakot-desktop-bg-position-y-v1'
const SIZE_KEY = 'anakot-desktop-bg-size-v1'
const DEFAULT_OPACITY = 0.15
const DEFAULT_POSITION_X = 50
const DEFAULT_POSITION_Y = 50
const DEFAULT_SIZE = 'cover'

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

function loadPositionX(): number {
  try {
    const v = window.localStorage.getItem(POSITION_X_KEY)
    return v ? parseInt(v, 10) : DEFAULT_POSITION_X
  } catch {
    return DEFAULT_POSITION_X
  }
}

function loadPositionY(): number {
  try {
    const v = window.localStorage.getItem(POSITION_Y_KEY)
    return v ? parseInt(v, 10) : DEFAULT_POSITION_Y
  } catch {
    return DEFAULT_POSITION_Y
  }
}

function loadSize(): string {
  try {
    return window.localStorage.getItem(SIZE_KEY) || DEFAULT_SIZE
  } catch {
    return DEFAULT_SIZE
  }
}

export const $backgroundImage = atom<string | null>(loadImage())
export const $backgroundOpacity = atom<number>(loadOpacity())
export const $backgroundPositionX = atom<number>(loadPositionX())
export const $backgroundPositionY = atom<number>(loadPositionY())
export const $backgroundSize = atom<string>(loadSize())

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

$backgroundPositionX.subscribe(x => {
  try {
    window.localStorage.setItem(POSITION_X_KEY, String(x))
  } catch { /* ignore */ }
})

$backgroundPositionY.subscribe(y => {
  try {
    window.localStorage.setItem(POSITION_Y_KEY, String(y))
  } catch { /* ignore */ }
})

$backgroundSize.subscribe(sz => {
  try {
    window.localStorage.setItem(SIZE_KEY, sz)
  } catch { /* ignore */ }
})

export function setBackgroundImage(url: string | null) {
  $backgroundImage.set(url)
}

export function setBackgroundOpacity(value: number) {
  $backgroundOpacity.set(value)
}

export function setBackgroundPositionX(value: number) {
  $backgroundPositionX.set(value)
}

export function setBackgroundPositionY(value: number) {
  $backgroundPositionY.set(value)
}

export function setBackgroundSize(value: string) {
  $backgroundSize.set(value)
}

export function getBackgroundImage(): string | null {
  return $backgroundImage.get()
}

export function getBackgroundOpacity(): number {
  return $backgroundOpacity.get()
}

export function getBackgroundPositionX(): number {
  return $backgroundPositionX.get()
}

export function getBackgroundPositionY(): number {
  return $backgroundPositionY.get()
}

export function getBackgroundSize(): string {
  return $backgroundSize.get()
}

/**
 * Save an uploaded image file to disk via the desktop bridge.
 * Returns a data URL for use in CSS.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  // Always convert to data URL for reliable CSS rendering.
  // file:// URLs are blocked by Electron's CSP in the renderer.
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}
