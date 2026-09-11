import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { Check, X, AlertTriangle, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Pill } from '@/app/settings/primitives'
import { $computerUseStatus, loadComputerUseStatus } from '@/store/computer-use'

export function ComputerUsePanel() {
  const status = useStore($computerUseStatus)

  useEffect(() => {
    void loadComputerUseStatus()
  }, [])

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

  return (
    <div className="space-y-3">
      {/* Platform check */}
      <div className="flex items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Platform</span>
            {isMac ? (
              <Pill tone="primary">
                <Check className="size-3" />
                macOS
              </Pill>
            ) : (
              <Pill tone="muted">
                <X className="size-3" />
                {navigator.platform || 'Unknown'}
              </Pill>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Computer Use requires macOS with the cua-driver binary installed.
          </p>
        </div>
      </div>

      {/* Driver status (macOS only) */}
      {isMac && (
        <div className="flex items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">cua-driver</span>
              {status.loading ? (
                <Pill tone="muted">Checking...</Pill>
              ) : status.available ? (
                <Pill tone="primary">
                  <Check className="size-3" />
                  Available
                </Pill>
              ) : (
                <Pill tone="muted">
                  <AlertTriangle className="size-3" />
                  Not found
                </Pill>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {status.available
                ? 'cua-driver binary detected. Computer Use is ready.'
                : 'Install cua-driver to enable Computer Use. See documentation for setup instructions.'}
            </p>
          </div>
        </div>
      )}

      {/* Permissions info (macOS only) */}
      {isMac && (
        <div className="rounded-lg border border-(--ui-stroke-tertiary) p-3">
          <h4 className="text-sm font-medium">Permissions</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Computer Use requires two macOS permissions granted to cua-driver:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className={cn('size-3', status.available ? 'text-green-500' : 'text-muted-foreground/50')} />
              Accessibility — control mouse and keyboard
            </li>
            <li className="flex items-center gap-2">
              <Check className={cn('size-3', status.available ? 'text-green-500' : 'text-muted-foreground/50')} />
              Screen Recording — capture screen content
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Run <code className="rounded bg-(--ui-bg-tertiary) px-1">cua-driver permissions grant</code> to request permissions.
          </p>
        </div>
      )}

      {/* Documentation link */}
      <a
        className="flex items-center gap-2 text-xs text-(--ui-accent-secondary) hover:underline"
        href="https://docs.anakot.ai/tools/computer-use"
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink className="size-3" />
        Computer Use documentation
      </a>
    </div>
  )
}
