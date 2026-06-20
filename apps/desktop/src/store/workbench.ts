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
  console.log('[workbench] openEditorTab:', tab)
  const tabs = $editorTabs.get()
  const existing = tabs.find(t => t.id === tab.id)
  if (existing) {
    $activeEditorTabId.set(tab.id)
    return
  }
  $editorTabs.set([...tabs, tab])
  $activeEditorTabId.set(tab.id)
  console.log('[workbench] editorTabs now:', $editorTabs.get())
}

export function closeEditorTab(id: string) {
  const tabs = $editorTabs.get().filter(t => t.id !== id)
  $editorTabs.set(tabs)
  const activeId = $activeEditorTabId.get()
  if (activeId === id) {
    $activeEditorTabId.set(tabs.length > 0 ? tabs[tabs.length - 1].id : null)
  }
}

export function setActiveEditorTab(id: string | null) {
  $activeEditorTabId.set(id)
}
