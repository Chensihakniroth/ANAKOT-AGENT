
import { lazy } from 'react'

// Lazy-load terminal — defers @xterm/xterm + addons (~492KB) until terminal tab is opened
export const LazyTerminalTab = lazy(
  async () => ({ default: (await import('./index')).TerminalTab })
)

export type { TerminalTabHandle } from './index'
