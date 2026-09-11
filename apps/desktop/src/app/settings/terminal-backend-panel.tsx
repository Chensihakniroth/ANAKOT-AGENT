import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { Check, AlertTriangle, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Pill } from '@/app/settings/primitives'
import {
  $terminalBackends,
  $terminalBackendsActive,
  $terminalBackendsLoading,
  loadTerminalBackends,
  selectTerminalBackend,
  type TerminalBackend
} from '@/store/terminal-backends'

function StatusPill({ backend }: { backend: TerminalBackend }) {
  if (backend.status === 'ready') {
    return (
      <Pill tone="primary">
        <Check className="size-3" />
        Ready
      </Pill>
    )
  }

  return (
    <Pill tone="muted">
      <AlertTriangle className="size-3" />
      {backend.status === 'needs_setup' ? 'Needs setup' : 'Unavailable'}
    </Pill>
  )
}

export function TerminalBackendPanel() {
  const backends = useStore($terminalBackends)
  const active = useStore($terminalBackendsActive)
  const loading = useStore($terminalBackendsLoading)

  useEffect(() => {
    void loadTerminalBackends()
  }, [])

  if (loading && backends.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {backends.map(backend => (
        <div
          key={backend.name}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
            backend.active
              ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary)'
              : 'border-(--ui-stroke-tertiary) hover:bg-(--chrome-action-hover)'
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{backend.label}</span>
              <StatusPill backend={backend} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{backend.description}</p>
            {backend.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground/70">{backend.detail}</p>
            )}
          </div>

          {backend.active ? (
            <Pill tone="primary">Active</Pill>
          ) : (
            <Tip label={`Switch to ${backend.label}`}>
              <Button
                disabled={backend.status === 'unavailable'}
                onClick={() => void selectTerminalBackend(backend.name)}
                size="sm"
                variant="text"
              >
                Select
              </Button>
            </Tip>
          )}
        </div>
      ))}
    </div>
  )
}
