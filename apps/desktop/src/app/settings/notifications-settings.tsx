import { useCallback, useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'

import { Switch } from '@/components/ui/switch'
import { Bell, RefreshCw } from '@/lib/icons'
import { triggerHaptic } from '@/lib/haptics'
import { Button } from '@/components/ui/button'

import { ListRow, SectionHeading, SettingsContent } from './primitives'
import {
  NATIVE_NOTIFICATION_KINDS,
  $nativeNotificationsEnabled,
  $nativeNotifyPrefs,
  loadNativeNotifyPrefs,
  notificationKindDescription,
  notificationKindLabel,
  resetNativeNotifyPrefs,
  setNativeNotificationsEnabled,
  setNativeNotifyKind,
  type NativeNotificationKind
} from '@/store/native-notifications'

export function NotificationsSettings() {
  const masterEnabled = useStore($nativeNotificationsEnabled)
  const prefKinds = useStore($nativeNotifyPrefs)
  const [loaded, setLoaded] = useState(false)

  // Load per-kind prefs from the backend once on mount
  useEffect(() => {
    if (!loaded) {
      setLoaded(true)
      void loadNativeNotifyPrefs()
    }
  }, [loaded])

  const handleToggleKind = useCallback(
    (kind: NativeNotificationKind, enabled: boolean) => {
      triggerHaptic('selection')
      void setNativeNotifyKind(kind, enabled)
    },
    []
  )

  const handleReset = useCallback(() => {
    triggerHaptic('warning')
    void resetNativeNotifyPrefs()
  }, [])

  return (
    <SettingsContent>
      <div className="space-y-1 divide-y divide-border/30">
        <SectionHeading icon={Bell} title="Notifications" />

        {/* Master toggle */}
        <ListRow
          action={<Switch checked={masterEnabled} onCheckedChange={setNativeNotificationsEnabled} />}
          description="Master switch for all native OS notifications."
          title="Native Notifications"
        />

        {/* Per-kind toggles */}
        {NATIVE_NOTIFICATION_KINDS.map(kind => (
          <ListRow
            action={
              <Switch
                checked={masterEnabled && prefKinds[kind]}
                disabled={!masterEnabled}
                onCheckedChange={enabled => handleToggleKind(kind, enabled)}
                size="xs"
              />
            }
            description={notificationKindDescription(kind)}
            key={kind}
            title={notificationKindLabel(kind)}
          />
        ))}

        {/* Reset */}
        <div className="pt-4">
          <Button
            className="gap-2"
            onClick={handleReset}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-3.5" />
            Reset to Defaults
          </Button>
        </div>
      </div>
    </SettingsContent>
  )
}