// Contrib controller — registers panes, layouts, and chrome contributions.

import { type ContribPane } from './types'

const registeredPanes: Map<string, ContribPane> = new Map()

export function registerContribPane(pane: ContribPane): () => void {
  registeredPanes.set(pane.id, pane)
  return () => { registeredPanes.delete(pane.id) }
}

export function getRegisteredPanes(): ContribPane[] {
  return Array.from(registeredPanes.values())
}

export function getRegisteredPane(id: string): ContribPane | undefined {
  return registeredPanes.get(id)
}
