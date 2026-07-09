import { atom, computed } from 'nanostores'

export interface TerminalTabInfo {
  id: string
  label: string
  shell?: 'powershell' | 'git-bash' | 'cmd'
}

let nextId = 1

export const $terminalTabs = atom<TerminalTabInfo[]>([
  { id: 'tab-1', label: 'Terminal', shell: 'powershell' }
])

export const $activeTerminalTabId = atom<string>('tab-1')

export const $activeTerminalTab = computed(
  [$terminalTabs, $activeTerminalTabId],
  (tabs, activeId) => tabs.find(t => t.id === activeId) ?? tabs[0] ?? null
)

export function addTerminalTab(shell?: 'powershell' | 'git-bash' | 'cmd'): string {
  nextId += 1
  const id = `tab-${nextId}`
  const label = nextId === 2 ? 'Terminal' : `Terminal ${nextId}`
  $terminalTabs.set([...$terminalTabs.get(), { id, label, shell }])
  $activeTerminalTabId.set(id)
  return id
}

export function closeTerminalTab(id: string): void {
  const tabs = $terminalTabs.get()
  if (tabs.length <= 1) return // Don't close the last tab
  const idx = tabs.findIndex(t => t.id === id)
  const next = tabs.filter(t => t.id !== id)
  $terminalTabs.set(next)
  if ($activeTerminalTabId.get() === id) {
    const newIdx = Math.min(idx, next.length - 1)
    $activeTerminalTabId.set(next[Math.min(newIdx, next.length - 1)].id)
  }
}

export function setActiveTerminalTab(id: string): void {
  $activeTerminalTabId.set(id)
}

export function updateTerminalTabShell(id: string, shell: 'powershell' | 'git-bash' | 'cmd'): void {
  const tabs = $terminalTabs.get()
  $terminalTabs.set(
    tabs.map(t => (t.id === id ? { ...t, shell } : t))
  )
}
