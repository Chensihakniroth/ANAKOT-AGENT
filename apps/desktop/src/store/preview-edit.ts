// Preview edit state — tracks preview targets with unsaved spot-editor changes.
// The rail renders a VS Code-style "modified" dot on the tab without threading
// editor state up through the pane.

import { atom } from 'nanostores'

export const $dirtyPreviewUrls = atom<Record<string, true>>({})

export function setPreviewDirty(url: string, dirty: boolean): void {
  if (!url) return
  const current = $dirtyPreviewUrls.get()
  const has = Boolean(current[url])
  if (dirty === has) return
  if (dirty) { $dirtyPreviewUrls.set({ ...current, [url]: true }); return }
  const next = { ...current }; delete next[url]; $dirtyPreviewUrls.set(next)
}
