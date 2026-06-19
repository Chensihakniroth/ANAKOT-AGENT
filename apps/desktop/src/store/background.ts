/**
 * Background image store — reactive nanostore for the desktop background image.
 * Persists to localStorage and notifies all subscribers on change.
 *
 * Uploaded images are saved to disk via the desktop bridge (ds-assets/ folder
 * in the app user data dir). Built-in images are referenced by their public/
 * path. The stored value is always a URL string:
 *   - Built-in:  "ds-assets/filler-bg0.jpg"  (relative, resolved at runtime)
 *   - Uploaded:  "file:///C:/Users/.../ds-assets/my-bg.png"  (absolute file:// URL)
 *   - Custom:    "data:image/png;base64,..."  (data URL, fallback)
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

/**
 * Save an uploaded image file to disk in the ds-assets/ folder.
 * Returns the file:// URL of the saved image, or falls back to data URL.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  // Try to save via desktop bridge
  if (window.anakotDesktop?.saveImageBuffer) {
    try {
      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer()
      const ext = file.name.split('.').pop() || 'png'
      const savedPath = await window.anakotDesktop.saveImageBuffer(
        new Uint8Array(buffer),
        ext
      )
      if (savedPath) {
        return `file://${savedPath}`
      }
    } catch {
      // Fall through to data URL fallback
    }
  }

  // Fallback: store as base64 data URL in localStorage
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}
