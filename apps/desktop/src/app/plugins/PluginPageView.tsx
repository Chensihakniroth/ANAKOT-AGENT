/**
 * PluginPageView — overlay wrapper that resolves the current route
 * to a plugin name and renders the PluginPage component.
 *
 * Uses the same usePlugins hook as PluginsView to trigger plugin
 * bundle loading and resolve manifests.
 */

import { Suspense, lazy } from 'react'
import { useLocation } from 'react-router-dom'

import { PluginPage } from './PluginPage'
import { KanbanView } from './KanbanView'
import { PluginScope } from './PluginScope'
import { usePlugins } from './usePlugins'

interface PluginPageViewProps {
  onClose: () => void
}

export function PluginPageView({ onClose }: PluginPageViewProps) {
  const location = useLocation()
  const { manifests, loading } = usePlugins()

  // Find the plugin whose tab.path matches the current location
  const manifest = manifests.find(m => m.tab.path === location.pathname)
  const pluginName = manifest?.name
  const pluginLabel = manifest?.label || manifest?.name || 'Plugin'

  if (loading && !manifest) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[var(--ui-text-tertiary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading plugin…</span>
        </div>
      </div>
    )
  }

  if (!pluginName) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-[var(--ui-text-tertiary)]">
          Plugin not found for route: {location.pathname}
        </div>
      </div>
    )
  }

  // Dedicated wrapper views for plugins that need special layout handling
  if (pluginName === 'kanban') {
    return (
      <Suspense fallback={<PluginLoadingShell label={pluginLabel} onClose={onClose} />}>
        <KanbanView />
      </Suspense>
    )
  }

  // Generic plugin wrapper with CSS variable bridging and scroll
  return (
    <div className="flex h-full flex-col">
      <PluginHeader label={pluginLabel} onClose={onClose} />
      <PluginScope>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PluginPage name={pluginName} />
        </div>
      </PluginScope>
    </div>
  )
}

function PluginHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-(--ui-stroke-secondary) px-4">
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-(--ui-text-secondary) hover:text-(--ui-text-primary) transition-colors"
        onClick={onClose}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

function PluginLoadingShell({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <PluginHeader label={label} onClose={onClose} />
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-(--ui-text-tertiary)">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading plugin…</span>
        </div>
      </div>
    </div>
  )
}
