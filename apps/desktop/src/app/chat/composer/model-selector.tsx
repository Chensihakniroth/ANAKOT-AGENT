import type { AnakotGateway } from '@/anakot'
import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { displayModelName } from '@/lib/model-status-label'
import { requestModelOptions } from '@/lib/model-options'
import { cn } from '@/lib/utils'
import {
  $currentModel,
  $currentProvider,
  setCurrentModel,
  setCurrentProvider
} from '@/store/session'
import type { ModelOptionsResponse } from '@/types/anakot'

import { GHOST_ICON_BTN } from './controls'

/**
 * A compact inline model selector for the composer toolbar. Shows the current
 * model name and provides a dropdown to switch models. Uses the same data
 * source as the statusbar model picker (gateway-first model options).
 */
export function ModelSelector({
  gateway,
  sessionId
}: {
  gateway?: AnakotGateway | null
  sessionId?: string | null
}) {
  const { t } = useI18n()
  const copy = t.composer
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const [open, setOpen] = useState(false)

  const modelOptions = useQuery({
    queryKey: ['model-options', sessionId || 'global'],
    queryFn: (): Promise<ModelOptionsResponse> =>
      requestModelOptions({ gateway: gateway ?? undefined, sessionId: sessionId ?? undefined }),
    enabled: open
  })

  const providers = modelOptions.data?.providers ?? []
  const optionsModel = modelOptions.data?.model ?? currentModel
  const optionsProvider = modelOptions.data?.provider ?? currentProvider
  const loading = modelOptions.isPending && !modelOptions.data

  const error = modelOptions.error
    ? modelOptions.error instanceof Error
      ? modelOptions.error.message
      : String(modelOptions.error)
    : null

  const switchTo = useCallback(
    (model: string, provider: string) => {
      setCurrentModel(model)
      setCurrentProvider(provider)
      setOpen(false)
    },
    []
  )

  const displayText = currentModel ? displayModelName(currentModel) : ''

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={copy.selectModel ?? 'Select model'}
          className={cn(
            GHOST_ICON_BTN,
            'max-w-[7rem] truncate px-1 text-[0.65rem] leading-none',
            !currentModel && 'text-(--ui-text-tertiary)'
          )}
          disabled={!currentModel}
          type="button"
        >
          {displayText || (copy.noModel ?? 'No model')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-56 overflow-y-auto"
        side="top"
      >
        {loading && (
          <div className="px-2.5 py-2 text-xs text-muted-foreground">
            {copy.loading ?? 'Loading…'}
          </div>
        )}
        {error && (
          <div className="px-2.5 py-2 text-xs text-destructive">{error}</div>
        )}
        {!loading && !error && providers.length === 0 && (
          <div className="px-2.5 py-2 text-xs text-muted-foreground">
            {copy.noModelsAvailable ?? 'No models available'}
          </div>
        )}
        {providers.map(provider => (
          <div key={provider.slug}>
            <DropdownMenuSeparator />
            <div className="px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
              {provider.name}
            </div>
            {(provider.models ?? []).map(model => {
              const active =
                model === optionsModel && provider.slug === optionsProvider

              return (
                <DropdownMenuItem
                  key={model}
                  className={cn(
                    'gap-2 text-xs',
                    active && 'bg-accent font-medium text-accent-foreground'
                  )}
                  onSelect={() => switchTo(model, provider.slug)}
                >
                  <span className="truncate">{displayModelName(model)}</span>
                  {active && (
                    <span className="ml-auto shrink-0 text-[0.6rem] text-(--ui-text-tertiary)">
                      ✓
                    </span>
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
