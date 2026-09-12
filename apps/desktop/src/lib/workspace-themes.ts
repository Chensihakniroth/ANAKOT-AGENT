// Workspace themes — per-workspace accent color overrides.
// Hermes stores this as ArrowDrive workspace accent colors; we implement a
// simplified version keyed by workspace id.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.workspaceThemes'

export interface WorkspaceTheme {
  workspaceId: string
  accentColor: string
}

function loadThemes(): Record<string, string> {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export const $workspaceThemes = atom<Record<string, string>>(loadThemes())
$workspaceThemes.subscribe(v => persistString(STORAGE_KEY, JSON.stringify(v)))

export function setWorkspaceAccentColor(workspaceId: string, color: null | string): void {
  const prev = $workspaceThemes.get()
  if (color) $workspaceThemes.set({ ...prev, [workspaceId]: color })
  else if (workspaceId in prev) { const next = { ...prev }; delete next[workspaceId]; $workspaceThemes.set(next) }
}

export function getWorkspaceAccentColor(workspaceId: string): string | undefined {
  return $workspaceThemes.get()[workspaceId]
}
