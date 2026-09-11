import type { SidebarMode } from '../app/interfaces.js'

// Fixed chat-width chevron rail on the right (opencode keeps a right-hand
// sidebar that only appears when the terminal is wide enough).
export const SIDEBAR_WIDTH = 34
export const SIDEBAR_MIN_TERM_WIDTH = 110

export const isSidebarVisible = (mode: SidebarMode, termCols: number): boolean => {
  if (mode === 'hidden') {
    return false
  }

  if (mode === 'shown') {
    return true
  }

  return termCols >= SIDEBAR_MIN_TERM_WIDTH
}

// Effective transcript/composer width when the sidebar is visible. Everything
// downstream (composer wrap, message body width, virtual-height keys, session
// create/resume/resize RPC cols) must agree on this so reflow stays coherent.
export const effectiveChatCols = (termCols: number, visible: boolean): number =>
  visible ? Math.max(1, termCols - SIDEBAR_WIDTH) : termCols