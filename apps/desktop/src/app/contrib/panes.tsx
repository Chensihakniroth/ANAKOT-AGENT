// Contrib panes — real-data pane bodies + statusbar group setters.

import { type ContribPane } from './types'

let statusbarGroupSetters: Array<(group: string) => void> = []

export function setStatusbarGroup(group: string): void {
  statusbarGroupSetters.forEach(fn => fn(group))
}

export function onStatusbarGroupSetter(fn: (group: string) => void): () => void {
  statusbarGroupSetters.push(fn)
  return () => {
    statusbarGroupSetters = statusbarGroupSetters.filter(f => f !== fn)
  }
}
