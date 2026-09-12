// Contrib surfaces — plugin-contributed pane system.
// The contribution-driven shell package. `controller` registers panes /
// layouts / chrome and mounts the app root; `wiring` is the data controller +
// memoized pane surfaces; `panes` holds the real-data pane bodies + statusbar
// group setters. Only the controller is a public entry (the app root renders
// it); the rest are internal to this directory.

export { registerContribPane, getRegisteredPanes, getRegisteredPane } from './controller'
export { createWiredPane, type WiredPane } from './wiring'
