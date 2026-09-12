// Fallback models field — configure a chain of fallback models.
// When the primary model fails, each fallback is tried in order.

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FallbackModel {
  provider: string
  model: string
}

interface FallbackModelsFieldProps {
  fallbacks: FallbackModel[]
  availableModels?: Array<{ provider: string; model: string; label: string }>
  onChange?: (fallbacks: FallbackModel[]) => void
  className?: string
}

const DEFAULT_MODELS = [
  { provider: 'anthropic', model: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { provider: 'anthropic', model: 'claude-haiku-3', label: 'Claude Haiku 3' },
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
]

export function FallbackModelsField({
  fallbacks,
  availableModels = DEFAULT_MODELS,
  onChange,
  className,
}: FallbackModelsFieldProps) {
  const [selectedProvider, setSelectedProvider] = useState('anthropic')
  const [selectedModel, setSelectedModel] = useState('')

  const modelsForProvider = availableModels.filter(m => m.provider === selectedProvider)

  const addFallback = () => {
    if (!selectedModel) return
    const newFallbacks = [...fallbacks, { provider: selectedProvider, model: selectedModel }]
    onChange?.(newFallbacks)
    setSelectedModel('')
  }

  const removeFallback = (index: number) => {
    onChange?.(fallbacks.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label className="text-sm font-medium">
        Fallback Models
      </label>
      <p className="text-xs text-muted-foreground">
        When the primary model fails, each fallback is tried in order.
      </p>

      {/* Current fallback chain */}
      {fallbacks.length > 0 && (
        <div className="space-y-1">
          {fallbacks.map((fb, i) => (
            <div
              key={`${fb.provider}/${fb.model}-${i}`}
              className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-1.5"
            >
              <span className="text-xs">
                <span className="font-medium">{i + 1}.</span> {fb.provider}/{fb.model}
              </span>
              <button
                onClick={() => removeFallback(i)}
                className="text-xs text-muted-foreground hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add fallback */}
      <div className="flex items-center gap-2">
        <select
          value={selectedProvider}
          onChange={e => {
            setSelectedProvider(e.target.value)
            setSelectedModel('')
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {[...new Set(availableModels.map(m => m.provider))].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Select model...</option>
          {modelsForProvider.map(m => (
            <option key={m.model} value={m.model}>{m.label}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={addFallback} disabled={!selectedModel}>
          Add
        </Button>
      </div>
    </div>
  )
}
