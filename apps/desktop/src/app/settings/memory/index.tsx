// Memory provider settings — selection and configuration of memory providers.

import { useState } from 'react'

import { cn } from '@/lib/utils'

export interface MemoryProvider {
  id: string
  name: string
  description: string
  configFields?: Array<{ key: string; label: string; type: 'string' | 'number' | 'boolean' }>
}

const KNOWN_MEMORY_PROVIDERS: MemoryProvider[] = [
  { id: 'none', name: 'None', description: 'No memory provider. Conversations are not persisted between sessions.' },
  { id: 'honcho', name: 'Honcho', description: 'Contextual memory with user modeling and preference inference.' },
  { id: 'mem0', name: 'Mem0', description: 'Persistent memory with semantic search and fact extraction.' },
  { id: 'supermemory', name: 'Supermemory', description: 'Cloud-synced memory with cross-device persistence.' },
]

interface MemoryProviderSettingsProps {
  selectedProvider?: string
  config?: Record<string, string | number | boolean>
  onProviderChange?: (providerId: string) => void
  onConfigChange?: (key: string, value: string | number | boolean) => void
  className?: string
}

export function MemoryProviderSettings({
  selectedProvider = 'none',
  config = {},
  onProviderChange,
  onConfigChange,
  className,
}: MemoryProviderSettingsProps) {
  const activeProvider = KNOWN_MEMORY_PROVIDERS.find(p => p.id === selectedProvider)

  return (
    <div className={cn('space-y-4', className)}>
      <label className="text-sm font-medium">
        Memory Provider
      </label>

      {/* Provider selection */}
      <div className="space-y-2">
        {KNOWN_MEMORY_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            onClick={() => onProviderChange?.(provider.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              selectedProvider === provider.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/30',
            )}
          >
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary">
              {selectedProvider === provider.id && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{provider.name}</p>
              <p className="text-xs text-muted-foreground">{provider.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Provider-specific config (placeholder for extensibility) */}
      {activeProvider?.id !== 'none' && (
        <div className="space-y-2 rounded-md border border-border/30 bg-muted/10 p-3">
          <p className="text-xs font-medium">
            Configuration
          </p>
          <p className="text-xs text-muted-foreground">
            {activeProvider?.name} is configured through its plugin settings.
          </p>
        </div>
      )}
    </div>
  )
}
