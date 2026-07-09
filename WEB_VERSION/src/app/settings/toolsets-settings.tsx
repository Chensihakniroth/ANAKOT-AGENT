import { useCallback, useEffect, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { getToolsets } from '@/anakot'
import { useI18n } from '@/i18n'
import { notifyError } from '@/store/notifications'
import type { ToolsetInfo } from '@/types/anakot'

import { ToolsetConfigPanel } from './toolset-config-panel'
import { SettingsContent, SettingsSection } from './primitives'

export function ToolsetsSettings() {
  const { t } = useI18n()
  const copy = t.settings.toolsets ?? {}
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getToolsets()
      setToolsets(all)
    } catch (err) {
      notifyError(err, copy.failedLoad ?? 'Failed to load tool backends')
    } finally {
      setLoading(false)
    }
  }, [copy.failedLoad])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) {
    return <PageLoader className="min-h-32" label={copy.loadingConfig ?? 'Loading tool backends...'} />
  }

  if (toolsets.length === 0) {
    return (
      <SettingsContent>
        <p className="px-1 py-6 text-xs text-muted-foreground">{copy.noProviders ?? 'No tool backends available.'}</p>
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      {toolsets.map(toolset => (
        <SettingsSection key={toolset.name}>
          <div className="rounded-xl border bg-background/60 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-medium">{toolset.label ?? toolset.name}</h3>
              {toolset.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {typeof toolset.description === 'string' ? toolset.description : ''}
                </p>
              )}
            </div>
            <ToolsetConfigPanel
              key={toolset.name}
              onConfiguredChange={() => void refresh()}
              toolset={toolset.name}
            />
          </div>
        </SettingsSection>
      ))}
    </SettingsContent>
  )
}
