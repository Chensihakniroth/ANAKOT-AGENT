// Session color — per-session color overrides that win over inherited project color.
// Desktop-local, keyed by durable lineage id so color survives session-id rotation.

import { atom, computed } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'
import { $projects } from '@/store/projects'
import { $sessions, sessionPinId } from '@/store/session'

const STORAGE_KEY = 'anakot.desktop.sessionColors'

function loadColors(): Record<string, string> {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export const $sessionColorOverrides = atom<Record<string, string>>(loadColors())
$sessionColorOverrides.subscribe(v => persistString(STORAGE_KEY, JSON.stringify(v)))

export function setSessionColorOverride(durableId: string, color: null | string): void {
  const prev = $sessionColorOverrides.get()
  if (color) $sessionColorOverrides.set({ ...prev, [durableId]: color })
  else if (durableId in prev) { const next = { ...prev }; delete next[durableId]; $sessionColorOverrides.set(next) }
}

export const $sessionColorById = computed([$sessions, $projects, $sessionColorOverrides], (sessions, projects, overrides) => {
  const map: Record<string, string> = {}
  for (const session of sessions) {
    if (overrides[sessionPinId(session)]) map[session.id] = overrides[sessionPinId(session)]
    else {
      const proj = projects.find(p => p.id === session._lineage_root_id || p.id === session.id)
      if (proj?.color) map[session.id] = proj.color
    }
  }
  return map
})

export function sessionColorFor(session: { id: string; _lineage_root_id?: string | null } | null | undefined): string | undefined {
  if (!session) return undefined
  const colors = $sessionColorById.get()
  if (colors[session.id]) return colors[session.id]
  const proj = $projects.get().find(p => p.id === session._lineage_root_id || p.id === session.id)
  if (proj?.color) return proj.color
  return undefined
}
