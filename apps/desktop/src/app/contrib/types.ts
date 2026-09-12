// Contrib types — shared type definitions for the contribution system.

export interface ContribPane {
  id: string
  title: string
  icon?: string
  render: () => React.ReactNode
}

export interface ContribRoute {
  key: string
  path: string
  title?: string
  render: () => React.ReactNode
}

export interface SidebarActions {
  panes: ContribPane[]
  routes: ContribRoute[]
}

export interface WiringActions {
  openPane: (paneId: string) => void
  closePane: (paneId: string) => void
  navigate: (path: string) => void
}
