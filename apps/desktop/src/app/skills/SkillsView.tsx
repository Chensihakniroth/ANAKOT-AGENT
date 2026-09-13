import { useEffect, useState } from 'react'

import { getToolsets, toggleToolset, getToolsetConfig } from '@/anakot'

interface Toolset {
  name: string
  label: string
  description: string
  enabled: boolean
  available: boolean
  configured: boolean
  tools: string[]
}

interface ToolsetConfig {
  has_category: boolean
  active_provider: string | null
  providers: Array<{ id: string; name: string }>
}

function stripEmoji(label: string): string {
  return label.replace(/^[^\w\s]+/u, '').trim()
}

export function SkillsView() {
  const [toolsets, setToolsets] = useState<Toolset[]>([])
  const [expandedToolset, setExpandedToolset] = useState<string | null>(null)
  const [config, setConfig] = useState<ToolsetConfig | null>(null)

  useEffect(() => {
    getToolsets().then((ts) => {
      setToolsets(ts as unknown as Toolset[])
    }).catch(() => {})
  }, [])

  const handleToggle = async (name: string, enabled: boolean) => {
    const result = await toggleToolset(name, !enabled)
    if (result && typeof result === 'object' && 'ok' in result && (result as { ok: boolean }).ok) {
      setToolsets(toolsets.map(t => t.name === name ? { ...t, enabled: !enabled } : t))
    }
  }

  const handleConfigure = async (name: string) => {
    if (expandedToolset === name) {
      setExpandedToolset(null)
      setConfig(null)
    } else {
      setExpandedToolset(name)
      const cfg = await getToolsetConfig(name)
      setConfig(cfg as unknown as ToolsetConfig)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold">Toolsets</h2>
      <div className="flex flex-col gap-2">
        {toolsets.map(toolset => (
          <div key={toolset.name} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  role="switch"
                  aria-checked={toolset.enabled}
                  aria-label={`Toggle ${toolset.label} toolset`}
                  tabIndex={0}
                  onClick={() => handleToggle(toolset.name, toolset.enabled)}
                  onKeyDown={(e) => e.key === 'Enter' && handleToggle(toolset.name, toolset.enabled)}
                  className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${
                    toolset.enabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    toolset.enabled ? 'left-5' : 'left-0.5'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stripEmoji(toolset.label)}</span>
                    {toolset.configured && (
                      <button
                        onClick={() => handleConfigure(toolset.name)}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                      >
                        Configured
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{toolset.description}</p>
                </div>
              </div>
              {toolset.configured && (
                <button
                  onClick={() => handleConfigure(toolset.name)}
                  className="text-sm text-primary hover:underline"
                >
                  Configure {stripEmoji(toolset.label)}
                </button>
              )}
            </div>
            {expandedToolset === toolset.name && config && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {config.active_provider ? `Active: ${config.active_provider}` : 'No provider configured'}
                </p>
              </div>
            )}
          </div>
        ))}
        {toolsets.length === 0 && (
          <p className="text-muted-foreground">No toolsets available</p>
        )}
      </div>
    </div>
  )
}
