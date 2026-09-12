// Preview status — session-scoped feed of previewable artifacts a tool produced.
// Surfaced as compact links in the composer status stack.

import { atom } from 'nanostores'

import { previewName } from '@/lib/preview-targets'

export interface PreviewArtifact {
  cwd: string
  id: string
  label: string
  target: string
}

const MAX_PER_SESSION = 4

export const $previewStatusBySession = atom<Record<string, PreviewArtifact[]>>({})

const writePreviews = (sid: string, items: PreviewArtifact[]) => {
  const current = $previewStatusBySession.get()
  if (items.length === 0) { if (!current[sid]) return; const next = { ...current }; delete next[sid]; $previewStatusBySession.set(next); return }
  $previewStatusBySession.set({ ...current, [sid]: items })
}

export function recordPreviewArtifact(sid: string, target: string, cwd: string): void {
  const raw = target.trim()
  if (!sid || !raw) return
  const list = $previewStatusBySession.get()[sid] ?? []
  if (list.some(item => item.id === raw)) return
  writePreviews(sid, [...list, { cwd, id: raw, label: previewName(raw), target: raw }].slice(-MAX_PER_SESSION))
}

export function dismissPreviewArtifact(sid: string, id: string): void {
  const list = $previewStatusBySession.get()[sid]
  if (list) writePreviews(sid, list.filter(item => item.id !== id))
}

export function clearPreviewArtifacts(sid: string): void { writePreviews(sid, []) }
