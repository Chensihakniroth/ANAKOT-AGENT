// Pane focus — explicit-request pane reveals keyed to backend focus_pane tool.
// Reveals desktop panes by name; returns false for unknown panes.

import { setFileBrowserOpen, setSidebarOpen } from './layout'

const PANE_REVEALERS: Record<string, () => void> = {
  chat: () => {},
  files: () => setFileBrowserOpen(true),
  sessions: () => setSidebarOpen(true),
}

export function revealDesktopPane(pane: string): boolean {
  const reveal = PANE_REVEALERS[pane]
  if (!reveal) return false
  reveal()
  return true
}
