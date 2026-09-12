// Sidebar sort mode — controls how sessions are ordered in the sidebar.
// Supports multiple ranking strategies: alphabetical, cost, date, pinned-first.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

export type SidebarSortMode = 'alphabetical' | 'cost' | 'date' | 'pinned-first'

const STORAGE_KEY = 'anakot.desktop.sidebarSort.mode'

export const $sidebarSortMode = atom<SidebarSortMode>(storedString(STORAGE_KEY) as SidebarSortMode ?? 'alphabetical')

$sidebarSortMode.subscribe(value => persistString(STORAGE_KEY, value))

export function setSidebarSortMode(mode: SidebarSortMode): void {
  $sidebarSortMode.set(mode)
}

export function nextSidebarSortMode(): SidebarSortMode {
  const modes: SidebarSortMode[] = ['alphabetical', 'cost', 'date', 'pinned-first']
  const current = $sidebarSortMode.get()
  const idx = (modes.indexOf(current) + 1) % modes.length
  setSidebarSortMode(modes[idx])
  return modes[idx]
}
