import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { Discord } from '@/lib/icons'

import { ListRow, SectionHeading } from './primitives'

/**
 * Settings page for Discord Rich Presence configuration.
 *
 * Allows the user to:
 * - Enable/disable Discord RPC
 * - Configure their Discord Application Client ID
 * - Test the connection
 */
export function DiscordRpcSettings() {
  const { t } = useI18n()
  const copy = t.settings.discordRpc

  const [clientId, setClientId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Load current config on mount
  useState(() => {
    const load = async () => {
      if (!window.anakotDesktop?.discordRpc) return
      try {
        const cfg = await window.anakotDesktop.discordRpc.getConfig()
        setClientId(cfg.clientId)
        setEnabled(cfg.enabled)
      } catch {
        // Defaults stay
      } finally {
        setLoaded(true)
      }
    }
    void load()
  })

  const save = async (newEnabled: boolean, newClientId: string) => {
    if (!window.anakotDesktop?.discordRpc) {
      setStatus('error')
      return
    }

    setSaving(true)
    try {
      await window.anakotDesktop.discordRpc.updateConfig({
        enabled: newEnabled,
        clientId: newClientId,
      })
      setStatus('saved')
      setEnabled(newEnabled)
      setClientId(newClientId)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (value: string) => {
    const newEnabled = value === 'on'
    void save(newEnabled, clientId)
  }

  const handleSave = () => {
    void save(enabled, clientId)
  }

  if (!window.anakotDesktop?.discordRpc) {
    return (
      <div>
        <SectionHeading icon={Discord} title={copy.title} />
        <p className="max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
          {copy.desktopOnly}
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div>
        <SectionHeading icon={Discord} title={copy.title} />
        <p className="max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
          {copy.loading}
        </p>
      </div>
    )
  }

  return (
    <div>
      <SectionHeading icon={Discord} title={copy.title} />
      <p className="max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {copy.intro}
      </p>

      <div className="mt-2 space-y-3">
        <ListRow
          action={
            <SegmentedControl
              onChange={handleToggle}
              options={[
                { id: 'off', label: t.common.off },
                { id: 'on', label: t.common.on }
              ]}
              value={enabled ? 'on' : 'off'}
            />
          }
          description={copy.toggleDesc}
          title={copy.toggleLabel}
          wide
        />

        {enabled && (
          <>
            <ListRow
              action={
                <div className="flex w-full max-w-sm items-center gap-2">
                  <Input
                    className="flex-1 font-mono text-xs"
                    onChange={e => setClientId(e.target.value)}
                    placeholder={copy.clientIdPlaceholder}
                    spellCheck={false}
                    value={clientId}
                  />
                  <Button
                    disabled={saving || !clientId.trim()}
                    onClick={handleSave}
                    size="sm"
                  >
                    {saving ? copy.saving : copy.save}
                  </Button>
                </div>
              }
              description={copy.clientIdDesc}
              title={copy.clientIdLabel}
              wide
            />

            <div className="rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-4 py-3">
              <h4 className="mb-1.5 text-sm font-medium">{copy.howToTitle}</h4>
              <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-(--ui-text-tertiary)">
                <li>{copy.step1}</li>
                <li>{copy.step2}</li>
                <li>{copy.step3}</li>
                <li>{copy.step4}</li>
              </ol>
              <a
                className="mt-2 inline-block text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                href="https://discord.com/developers/applications"
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.devPortalLink}
              </a>
            </div>

            {status === 'saved' && (
              <p className="text-xs text-(--ui-green)">{copy.savedMessage}</p>
            )}
            {status === 'error' && (
              <p className="text-xs text-(--ui-red)">{copy.errorMessage}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
