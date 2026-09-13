import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { $updateChecking, $managedUpdates, checkForUpdates, installUpdate } from '@/store/updates'
import { $updateNotificationState } from '@/store/updates'
import { gatewayRpc } from '@/lib/gateway-rpc'

export function UpdatesSettings() {
  const { t } = useI18n()
  const updateChecking = useStore($updateChecking)
  const updateStatus = useStore($managedUpdates)
  const notificationState = useStore($updateNotificationState)

  const handleCheck = async () => {
    try {
      const result = await gatewayRpc<{ available: boolean; version?: string }>('updates.check')
      if (result.available) {
        // Show notification
      }
    } catch {
      // Ignore
    }
  }

  const handleInstall = async () => {
    try {
      await gatewayRpc('updates.install', {})
    } catch {
      // Ignore
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h2 className="text-lg font-semibold">Updates</h2>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Current Version</span>
          <span className="text-sm text-muted-foreground">{updateStatus.version || 'Unknown'}</span>
        </div>

        {updateStatus.available && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="font-medium">Update Available</h3>
            <p className="text-sm text-muted-foreground">Version {updateStatus.version}</p>
            <button
              onClick={handleInstall}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Install Update
            </button>
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={updateChecking}
          className="self-start rounded-md border px-4 py-2"
        >
          {updateChecking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>
    </div>
  )
}
