/**
 * Background image settings — reactive nanostore-backed.
 * For use in settings UI components.
 *
 * The actual persistence + reactivity lives in @/store/background.
 * This module re-exports the store functions and adds file-reading helpers.
 */

import {
  getBackgroundImage,
  getBackgroundOpacity,
  getBackgroundPositionX,
  getBackgroundPositionY,
  getBackgroundSize,
  saveUploadedImage,
  setBackgroundImage,
  setBackgroundOpacity,
  setBackgroundPositionX,
  setBackgroundPositionY,
  setBackgroundSize
} from '@/store/background'

export {
  getBackgroundImage,
  getBackgroundOpacity,
  getBackgroundPositionX,
  getBackgroundPositionY,
  getBackgroundSize,
  saveUploadedImage,
  setBackgroundImage,
  setBackgroundOpacity,
  setBackgroundPositionX,
  setBackgroundPositionY,
  setBackgroundSize
}

/** Built-in background images shipped with the app. */
export const BUILT_IN_BACKGROUNDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'filler-bg0', label: 'Filler', path: 'ds-assets/filler-bg0.jpg' },
  { id: 'callmemo-girl', label: 'Callmemo Girl', path: 'callmemo-girl.jpg' },
]

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
