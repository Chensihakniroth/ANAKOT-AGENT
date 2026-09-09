import { useCallback, useEffect, useState } from 'react'

import { getAnakotConfigRecord, saveAnakotConfig } from '@/anakot'
import { Switch } from '@/components/ui/switch'
import { Globe } from '@/lib/icons'
import { triggerHaptic } from '@/lib/haptics'
import { notifyError } from '@/store/notifications'

import { ListRow, SectionHeading, SettingsContent } from './primitives'

/**
 * Helper to extract `browser.use_real_profile` from the config record,
 * guarding against missing or malformed nested objects.
 */
function readUseRealProfile(config: Record<string, unknown>): boolean {
  const browser = config.browser as Record<string, unknown> | undefined
  if (!browser || typeof browser !== 'object') return false
  return Boolean(browser.use_real_profile)
}

/**
 * Browser Real Profile settings panel.
 *
 * When enabled, Anakot Desktop will clone the default browser's real Chrome
 * profile (cookies, logins) into a managed copy for use by the automated
 * browser tool. When disabled, a clean isolated profile is used instead.
 */
export function BrowserRealProfilePanel() {
  const [enabled, setEnabled] = useState(false)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const record = await getAnakotConfigRecord()
      setConfig(record as unknown as Record<string, unknown>)
      setEnabled(readUseRealProfile(record as unknown as Record<string, unknown>))
    } catch {
      // Config system unavailable
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleToggle = useCallback(
    async (on: boolean) => {
      if (!config) return
      setSaving(true)
      setEnabled(on) // Optimistic

      try {
        const next = {
          ...config,
          browser: {
            ...(config.browser as Record<string, unknown> | undefined),
            use_real_profile: on
          }
        }
        const result = await saveAnakotConfig(next as any)
        if (!result?.ok) throw new Error('Save failed')
        triggerHaptic('success')
        setConfig(next)
      } catch (err) {
        setEnabled(!on) // Revert on failure
        notifyError(err, 'Failed to save browser profile setting.')
      } finally {
        setSaving(false)
      }
    },
    [config]
  )

  if (loading) return null

  return (
    <SettingsContent>
      <div className="space-y-1 divide-y divide-border/30">
        <SectionHeading icon={Globe} title="Browser Profile" />

        <ListRow
          action={
            <Switch
              checked={enabled}
              disabled={saving}
              onCheckedChange={value => void handleToggle(value)}
            />
          }
          description="Allow Anakot to use your real browser profile (cookies, logins) for automated browser tasks. When off, a clean isolated profile is used."
          title="Use Real Browser Profile"
        />
      </div>
    </SettingsContent>
  )
}