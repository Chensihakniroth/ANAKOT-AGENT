/**
 * Workbench layout store — controls the VS Code-style panel visibility
 * and active sidebar panel.
 */
import { atom } from 'nanostores'

export type SidebarPanelId = 'explorer' | 'search' | 'chat' | 'none'
export type BottomPanelTabId = 'terminal' | 'output' | 'problems'

/** Which sidebar panel is visible */
export const $sidebarPanel = atom<SidebarPanelId>('explorer')

/** Is the sidebar itself open (as opposed to just the activity bar) */
export const $sidebarOpen = atom<boolean>(true)

/** Is the bottom panel visible */
export const $bottomPanelOpen = atom<boolean>(true)

/** Which bottom panel tab is active */
export const $bottomPanelTab = atom<BottomPanelTabId>('terminal')

/** Editor tab state */
export interface EditorTab {
  id: string
  path: string
  label: string
  /** Dirty indicator — true when file has unsaved changes */
  dirty: boolean
}

export const $editorTabs = atom<EditorTab[]>([])
export const $activeEditorTabId = atom<string | null>(null)

export function setSidebarPanel(panel: SidebarPanelId) {
  $sidebarPanel.set(panel)
}

export function toggleSidebar() {
  $sidebarOpen.set(!$sidebarOpen.get())
}

export function setBottomPanelOpen(open: boolean) {
  $bottomPanelOpen.set(open)
}

export function setBottomPanelTab(tab: BottomPanelTabId) {
  $bottomPanelTab.set(tab)
}

export function openEditorTab(tab: EditorTab) {
  const tabs = $editorTabs.get()
  const existing = tabs.find(t => t.id === tab.id)
  if (existing) {
    $activeEditorTabId.set(tab.id)
    return
  }
  $editorTabs.set([...tabs, tab])
  $activeEditorTabId.set(tab.id)
}

export function closeEditorTab(id: string) {
  const prevTabs = $editorTabs.get()
  const closedTab = prevTabs.find(t => t.id === id)
  const tabs = prevTabs.filter(t => t.id !== id)
  $editorTabs.set(tabs)
  const activeId = $activeEditorTabId.get()
  if (activeId === id) {
    $activeEditorTabId.set(tabs.length > 0 ? tabs[tabs.length - 1].id : null)
  }
  // Clear the active file breadcrumb if the closed tab was the active file
  if (closedTab) {
    const activeFile = $activeFilePath.get()
    if (activeFile && closedTab.path === activeFile) {
      $activeFilePath.set(null)
    }
  }
}

export function setActiveEditorTab(id: string | null) {
  $activeEditorTabId.set(id)
}

export function closeOtherTabs(id: string) {
  const tabs = $editorTabs.get()
  const kept = tabs.filter(t => t.id === id)
  $editorTabs.set(kept)
  if ($activeEditorTabId.get() !== id) {
    $activeEditorTabId.set(id)
  }
}

export function closeAllTabs() {
  $editorTabs.set([])
  $activeEditorTabId.set(null)
}

export function closeTabsToTheRight(id: string) {
  const tabs = $editorTabs.get()
  const index = tabs.findIndex(t => t.id === id)
  if (index === -1) return
  const kept = tabs.slice(0, index + 1)
  $editorTabs.set(kept)
  const activeId = $activeEditorTabId.get()
  if (activeId && !kept.some(t => t.id === activeId)) {
    $activeEditorTabId.set(kept.length > 0 ? kept[kept.length - 1].id : null)
  }
}

// ── Active file breadcrumb ──────────────────────────────────────────────────

export const $activeFilePath = atom<string | null>(null)

export function setActiveFilePath(path: string | null) {
  $activeFilePath.set(path)
}

// ── Recent files ────────────────────────────────────────────────────────────

export interface RecentFileEntry {
  path: string
  label: string
  openedAt: number
}

const MAX_RECENT_FILES = 10

export const $recentFiles = atom<RecentFileEntry[]>([])

export function openRecentFile(path: string, label: string) {
  $activeFilePath.set(path)
  const prev = $recentFiles.get().filter(f => f.path !== path)
  const entry: RecentFileEntry = { path, label, openedAt: Date.now() }
  $recentFiles.set([entry, ...prev].slice(0, MAX_RECENT_FILES))
}

export function closeActiveFile() {
  $activeFilePath.set(null)
}
