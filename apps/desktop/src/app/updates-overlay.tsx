import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  $managedUpdates,
  $desktopVersion,
  $updateChecking,
  checkForUpdates,
  installUpdate,
  setUpdateOverlayOpen,
} from '@/store/updates'

export function UpdatesOverlay() {
  const updates = useStore($managedUpdates)
  const version = useStore($desktopVersion)
  const checking = useStore($updateChecking)
  const [lastAction, setLastAction] = useState<string | null>(null)

  // Check on mount
  useEffect(() => {
    if (!version.appVersion) {
      void checkForUpdates()
    }
  }, [version.appVersion])

  const handleCheck = async () => {
    setLastAction('Checking...')
    await checkForUpdates()
    setLastAction(null)
  }

  const handleInstall = async () => {
    setLastAction('Starting update...')
    await installUpdate()
    setLastAction(null)
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Updates</h2>
          <p className="text-sm text-(--ui-text-tertiary)">
            Current version: <span className="font-mono">{version.appVersion || '—'}</span>
          </p>
        </div>
        <Button onClick={handleCheck} disabled={checking} variant="outline" size="sm">
          <Codicon
            name={checking ? 'loading' : 'refresh'}
            size="0.875rem"
            className={checking ? 'animate-spin' : ''}
            spinning={checking}
          />
          <span className="ml-1.5">{checking ? 'Checking...' : 'Check now'}</span>
        </Button>
      </div>

      {/* Status / Result */}
      {updates.available ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Codicon name="cloud-download" size="1.25rem" className="mt-0.5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="font-medium">Update Available</h3>
              <p className="mt-1 text-sm text-(--ui-text-secondary)">
                {updates.message || `You are ${updates.behind} commit${updates.behind === 1 ? '' : 's'} behind.`}
              </p>

              {updates.supported ? (
                <Button onClick={handleInstall} disabled={!!lastAction} size="sm" className="mt-3">
                  <Codicon name="download" size="0.875rem" />
                  <span className="ml-1.5">{lastAction || 'Install Update'}</span>
                </Button>
              ) : (
                <p className="mt-2 text-xs text-(--ui-text-tertiary)">
                  This install type requires manual update. Run{' '}
                  <code className="rounded bg-(--ui-bg-elevated) px-1 py-0.5 font-mono text-[0.6875rem]">
                    anakot update
                  </code>{' '}
                  in your terminal.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : updates.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Codicon name="warning" size="1.25rem" className="mt-0.5 shrink-0 text-destructive" />
            <div>
              <h3 className="font-medium text-destructive">Check Failed</h3>
              <p className="mt-1 text-sm text-(--ui-text-secondary)">{updates.error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-(--ui-bg-elevated) p-4">
          <div className="flex items-center gap-3">
            <Codicon name="check" size="1.25rem" className="text-primary" />
            <div>
              <h3 className="font-medium">Up to Date</h3>
              <p className="text-sm text-(--ui-text-tertiary)">
                You're running the latest version of Anakot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last checked */}
      {updates.fetchedAt && (
        <p className="text-xs text-(--ui-text-tertiary)">
          Last checked: {new Date(updates.fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
