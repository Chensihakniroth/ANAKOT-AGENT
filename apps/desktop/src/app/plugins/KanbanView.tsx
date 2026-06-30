/**
 * KanbanView — wraps the kanban plugin for the desktop overlay.
 *
 * Layout requirements:
 * - The plugin renders .anakot-kanban.flex.flex-col with BoardColumns inside
 * - BoardColumns (.anakot-kanban-columns) uses display:flex + overflow-x:auto
 * - Each column has a fixed width and its body scrolls vertically
 * - We need the whole thing to fill the overlay's available height
 */

import { lazy } from 'react'

import { PluginScope } from './PluginScope'
import { PluginPage } from './PluginPage'

const KanbanPluginPage = lazy(async () => ({
  default: (await import('./PluginPage')).PluginPage,
}))

export function KanbanView() {
  return (
    <PluginScope>
      <div className="flex h-full min-h-0 flex-col">
        <KanbanPluginPage name="kanban" />
      </div>
    </PluginScope>
  )
}
