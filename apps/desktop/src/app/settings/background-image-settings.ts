/**
 * Background image settings — persisted to localStorage as base64 data URL.
 * Applied to the app shell via --app-bg-image CSS custom property.
 */

const STORAGE_KEY = 'anakot-desktop-bg-image-v1'
const OPACITY_KEY = 'anakot-desktop-bg-opacity-v1'
const DEFAULT_OPACITY = 0.15

/** Built-in background images shipped with the app. */
export const BUILT_IN_BACKGROUNDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'filler-bg0', label: 'Filler', path: 'ds-assets/filler-bg0.jpg' },
  { id: 'callmemo-girl', label: 'Callmemo Girl', path: 'callmemo-girl.jpg' },
]

export function getBackgroundImage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function setBackgroundImage(dataUrl: string | null) {
  try {
    if (dataUrl) {
      window.localStorage.setItem(STORAGE_KEY, dataUrl)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage full or unavailable
  }
}

export function getBackgroundOpacity(): number {
  try {
    const v = window.localStorage.getItem(OPACITY_KEY)
    return v ? parseFloat(v) : DEFAULT_OPACITY
  } catch {
    return DEFAULT_OPACITY
  }
}

export function setBackgroundOpacity(value: number) {
  try {
    window.localStorage.setItem(OPACITY_KEY, String(value))
  } catch {
    // ignore
  }
}

/**
 * Read a File as a data URL. Rejects if the file is not an image or exceeds maxBytes.
 */
export function readFileAsDataUrl(file: File, maxBytes = 10_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file.'))
      return
    }
    if (file.size > maxBytes) {
      reject(new Error(`Image must be under ${(maxBytes / 1_000_000).toFixed(0)} MB.`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}
