import { atom } from 'nanostores'

// Model visibility state — stub for Hermes parity
// Full implementation: featured models, provider visibility, search

export const $modelVisibilityOpen = atom<boolean>(false)

export function setModelVisibilityOpen(open: boolean): void {
  $modelVisibilityOpen.set(open)
}

export interface ModelVisibilityState {
  searchQuery: string
  showFeaturedOnly: boolean
}

export const $modelVisibilityState = atom<ModelVisibilityState>({
  searchQuery: '',
  showFeaturedOnly: false,
})

export function setModelVisibilitySearch(query: string): void {
  $modelVisibilityState.set({ ...$modelVisibilityState.get(), searchQuery: query })
}

export function setShowFeaturedOnly(show: boolean): void {
  $modelVisibilityState.set({ ...$modelVisibilityState.get(), showFeaturedOnly: show })
}

// Model visibility configuration
export interface ModelFamily {
  id: string
  fastId: string
  name: string
  models: string[]
}

export const $visibleModels = atom<Set<string>>(new Set())
export const $modelFamilies = atom<ModelFamily[]>([])
export const DEFAULT_VISIBLE_PER_PROVIDER = 5

export function setModelVisible(modelId: string, visible: boolean): void {
  const next = new Set($visibleModels.get())
  if (visible) {
    next.add(modelId)
  } else {
    next.delete(modelId)
  }
  $visibleModels.set(next)
}

export function collapseModelFamilies(models?: string[]): ModelFamily[] {
  // Stub: collapse all model families
  if (!models || models.length === 0) {
    return $modelFamilies.get()
  }
  // Group models by provider
  return [{
    id: 'default',
    fastId: 'default',
    name: 'Models',
    models: models,
  }]
}

export function expandModelFamilies(): ModelFamily[] {
  // Stub: expand all model families
  return $modelFamilies.get()
}

export function modelVisibilityKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

export function effectiveVisibleKeys(_stored?: unknown, _providers?: unknown): Set<string> {
  return $visibleModels.get()
}

export function setVisibleModels(models: string[] | Set<string>): void {
  $visibleModels.set(new Set(Array.isArray(models) ? models : [...models]))
}
