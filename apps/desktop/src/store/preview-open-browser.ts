// Preview open browser — state for opening preview targets in an external browser.
// Tracks which preview targets have been opened externally to avoid duplicates.

import { atom } from 'nanostores'

export const $previewOpenBrowser = atom<Record<string, true>>({})

export function markPreviewOpened(url: string): void {
  if (!url) return
  $previewOpenBrowser.set({ ...$previewOpenBrowser.get(), [url]: true })
}

export function isPreviewOpened(url: string): boolean {
  return Boolean($previewOpenBrowser.get()[url])
}

export function clearPreviewOpened(url: string): void {
  if (!url) return
  const next = { ...$previewOpenBrowser.get() }; delete next[url]; $previewOpenBrowser.set(next)
}
