// Contrib dev — development utilities for the contribution system.

import { registerContribPane } from '../controller'

/** Register a dev-only contrib pane (for testing). */
export function registerDevPanes(): void {
  registerContribPane({
    id: 'dev-inspector',
    title: 'Dev Inspector',
    render: () => null,
  })
}
