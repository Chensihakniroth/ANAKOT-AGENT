import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import type { AnakotGateway } from '@/anakot'
import { setGlobalModel } from '@/anakot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { Leaf, Search } from '@/lib/icons'
import { requestModelOptions } from '@/lib/model-options'
import { displayModelName, modelDisplayParts } from '@/lib/model-status-label'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $currentModel, $currentProvider, setCurrentModel, setCurrentProvider } from '@/store/session'
import type { ModelOptionProvider } from '@/types/anakot'

import { ModelProbeScratchpad } from './model-probe-scratchpad'
import { SectionHeading, SettingsContent } from './primitives'

interface FreeModelSuiteSettingsProps {
  gateway?: AnakotGateway | null
  /** Notified after the main model is persisted to the backend, so the live UI
   * stores and query cache can sync (mirrors `ModelSettings.onMainModelChanged`).
   * Without this the store atom updates but the chat still falls back to the
   * default model on the next prompt. */
  onMainModelChanged?: (provider: string, model: string) => void
}

interface FreeProviderGroup {
  provider: ModelOptionProvider
  freeModels: string[]
}

function isModelFree(provider: ModelOptionProvider, model: string): boolean {
  const pricing = provider.pricing?.[model]

  const normalizedModel = model.toLowerCase()

  if (normalizedModel.endsWith(':free') || normalizedModel.endsWith('-free')) {return true}

  if (pricing?.free) {return true}

  if (provider.free_tier && !provider.unavailable_models?.includes(model)) {return true}

  return false
}

function getFreeProviders(providers: ModelOptionProvider[]): FreeProviderGroup[] {
  return providers
    .filter(provider => provider.authenticated === true)
    .map(provider => ({
      provider,
      freeModels: (provider.models ?? []).filter(m => isModelFree(provider, m)),
    }))
    .filter(group => group.freeModels.length > 0)
}

function formatContextWindow(tokens: number | undefined): string | null {
  if (!tokens || tokens <= 0) {return null}

  if (tokens >= 1_000_000) {return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 ? 1 : 0)}M context`}
  if (tokens >= 1_000) {return `${Math.round(tokens / 1_000)}K context`}

  return `${tokens} context`
}

export function FreeModelSuiteSettings({ gateway, onMainModelChanged }: FreeModelSuiteSettingsProps) {
  const { t } = useI18n()
  const copy = t.freeModelSuite
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const [search, setSearch] = useState('')

  const modelOptions = useQuery({
    queryKey: ['model-options'],
    queryFn: () => requestModelOptions({ gateway: gateway ?? undefined }),
  })

  const providers = modelOptions.data?.providers ?? []
  const freeGroups = useMemo(() => getFreeProviders(providers), [providers])
  const totalFree = useMemo(() => freeGroups.reduce((sum, g) => sum + g.freeModels.length, 0), [freeGroups])

  const q = search.trim().toLowerCase()

  const filteredGroups = useMemo(() => {
    if (!q) {return freeGroups}

    return freeGroups
      .map(group => ({
        ...group,
        freeModels: group.freeModels.filter(m => {
          const { name } = modelDisplayParts(m)

          return (
            m.toLowerCase().includes(q) ||
            name.toLowerCase().includes(q) ||
            group.provider.name.toLowerCase().includes(q) ||
            group.provider.slug.toLowerCase().includes(q)
          )
        }),
      }))
      .filter(g => g.freeModels.length > 0)
  }, [freeGroups, q])

  const handleSelect = useCallback(
    async (provider: ModelOptionProvider, model: string) => {
      setCurrentProvider(provider.slug)
      setCurrentModel(model)
      notify({ kind: 'success', title: copy.switched, message: `${provider.name} · ${model}` })

      // The store atom alone isn't enough — the chat resolves the active model
      // from the backend, so without persisting here the next prompt silently
      // falls back to the default. Mirrors `ModelSettings.applyMainModel`.
      try {
        await setGlobalModel(provider.slug, model)
        onMainModelChanged?.(provider.slug, model)
      } catch (err) {
        notifyError(err, copy.switchFailed)
      }
    },
    [copy, onMainModelChanged]
  )

  const isCurrent = useCallback(
    (providerSlug: string, model: string) => providerSlug === currentProvider && model === currentModel,
    [currentProvider, currentModel]
  )

  return (
    <SettingsContent>
      <div className="grid gap-5">
        <header className="grid gap-2">
          <SectionHeading icon={Leaf} title={copy.title} />
          <p className="text-xs text-muted-foreground">{copy.description({ count: totalFree })}</p>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoComplete="off"
            className="pl-8 text-xs"
            onChange={event => setSearch(event.target.value)}
            placeholder={copy.search}
            value={search}
          />
        </div>

        {modelOptions.isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton className="h-9 w-full" key={i} />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-card/40 px-3 py-6 text-center text-xs text-muted-foreground">
            {q ? copy.noResults : modelOptions.data ? copy.noFreeModels : copy.noProviders}
          </p>
        ) : (
          <div className="grid gap-4">
            {filteredGroups.map(group => (
              <section className="grid gap-1.5" key={group.provider.slug}>
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-xs font-semibold text-(--ui-text-primary)">{group.provider.name}</h3>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {group.provider.slug} · {group.freeModels.length} {copy.freeTier.toLowerCase()}
                  </span>
                  {group.provider.free_tier === true && (
                    <span className="rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      {copy.freeTier}
                    </span>
                  )}
                </div>
                <div className="grid gap-1">
                  {group.freeModels.map(model => {
                    const { name, tag } = modelDisplayParts(model)
                    const context = formatContextWindow(group.provider.context_windows?.[model])
                    const active = isCurrent(group.provider.slug, model)

                    return (
                      <div
                        className={cn(
                          'flex flex-col rounded-md border border-border/60 bg-card/60 px-3 py-2',
                          active && 'border-emerald-500/60 bg-emerald-500/10'
                        )}
                        key={`${group.provider.slug}:${model}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid min-w-0 flex-1">
                            <span className="truncate font-mono text-xs text-(--ui-text-primary)">
                              {displayModelName(model)}
                            </span>
                            {tag && (
                              <span className="text-[0.65rem] text-(--ui-text-tertiary)">
                                {name === tag ? '' : tag}
                              </span>
                            )}
                            {context && (
                              <span className="text-[0.65rem] text-(--ui-text-tertiary)">
                                {context}
                              </span>
                            )}
                          </div>
                          {active && (
                            <span className="rounded-sm bg-emerald-500 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-foreground">
                              {copy.current}
                            </span>
                          )}
                          <Button
                            disabled={active}
                            onClick={() => handleSelect(group.provider, model)}
                            size="sm"
                            variant={active ? 'ghost' : 'textStrong'}
                          >
                            {active ? copy.current : t.common.apply}
                          </Button>
                        </div>
                        {!active && (
                          <ModelProbeScratchpad
                            model={model}
                            onApply={handleSelect}
                            provider={group.provider}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="text-[0.7rem] text-muted-foreground">{copy.footerHint({ count: totalFree })}</p>
      </div>
    </SettingsContent>
  )
}
