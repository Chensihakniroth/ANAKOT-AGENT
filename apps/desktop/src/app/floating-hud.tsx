import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { $currentModel, $currentProvider } from '@/store/session'
import { displayModelName } from '@/lib/model-status-label'
import { useNavigate } from 'react-router-dom'
import {
  $floatingHudState,
  $floatingHudVisible,
  hideFloatingHud,
  pinFloatingHud,
} from '@/store/floating-hud'

export function FloatingHud() {
  const visible = useStore($floatingHudVisible)
  const { pinned } = useStore($floatingHudState)
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const navigate = useNavigate()

  if (!visible) return null

  return (
    <div
      className="fixed bottom-10 right-4 z-50 flex w-52 flex-col gap-1 rounded-lg border border-border bg-(--chrome-panel-bg) p-2 shadow-xl [--hud-row-h:1.75rem]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[0.625rem] font-medium uppercase tracking-wider text-(--ui-text-tertiary)">
          Quick
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={pinFloatingHud}
            className={`rounded p-0.5 transition-colors ${
              pinned
                ? 'text-primary'
                : 'text-(--ui-text-tertiary) hover:text-foreground'
            }`}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <Codicon name="pinned" size="0.75rem" />
          </button>
          <button
            onClick={hideFloatingHud}
            className="rounded p-0.5 text-(--ui-text-tertiary) hover:text-foreground"
            title="Close"
          >
            <Codicon name="close" size="0.75rem" />
          </button>
        </div>
      </div>

      {/* Model */}
      <button
        onClick={() => navigate('/settings?tab=models')}
        className="flex h-(--hud-row-h) items-center gap-2 rounded px-2 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover)"
      >
        <Codicon name="symbol-method" size="0.75rem" className="shrink-0 text-(--ui-text-tertiary)" />
        <span className="truncate">
          {currentModel ? displayModelName(currentModel) : 'No model'}
        </span>
        {currentProvider && (
          <span className="ml-auto shrink-0 text-[0.6rem] text-(--ui-text-tertiary)">
            {currentProvider}
          </span>
        )}
      </button>

      {/* New session */}
      <button
        onClick={() => {
          navigate('/chat')
          if (!pinned) hideFloatingHud()
        }}
        className="flex h-(--hud-row-h) items-center gap-2 rounded px-2 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover)"
      >
        <Codicon name="add" size="0.75rem" className="shrink-0 text-(--ui-text-tertiary)" />
        New Session
      </button>

      {/* Open settings */}
      <button
        onClick={() => {
          navigate('/settings')
          if (!pinned) hideFloatingHud()
        }}
        className="flex h-(--hud-row-h) items-center gap-2 rounded px-2 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover)"
      >
        <Codicon name="gear" size="0.75rem" className="shrink-0 text-(--ui-text-tertiary)" />
        Settings
      </button>

      {/* Open command center */}
      <button
        onClick={() => {
          navigate('/command-center')
          if (!pinned) hideFloatingHud()
        }}
        className="flex h-(--hud-row-h) items-center gap-2 rounded px-2 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover)"
      >
        <Codicon name="output" size="0.75rem" className="shrink-0 text-(--ui-text-tertiary)" />
        Command Center
      </button>
    </div>
  )
}
