// Contrib wiring — data controller + memoized pane surfaces.

import { type ContribPane, type WiringActions } from './types'

export interface WiredPane {
  pane: ContribPane
  actions: WiringActions
}

export function createWiredPane(pane: ContribPane, actions: WiringActions): WiredPane {
  return { pane, actions }
}
