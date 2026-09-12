// Per-model reasoning/fast presets.
// Remembers the effort + fast toggle per `provider::model` key.
// Applied to the active session whenever the matching model is selected.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.model-presets'

export interface ModelPreset {
  effort?: string
  fast?: boolean
}

export type ModelPresetsMap = Record<string, ModelPreset>

/** Stable `provider::model` key (matches the model-visibility-store format). */
export const modelPresetKey = (provider: string, model: string): string => `${provider}::${model}`

function load(): ModelPresetsMap {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ModelPresetsMap) : {}
  } catch {
    return {}
  }
}

export const $modelPresets = atom<ModelPresetsMap>(load())

$modelPresets.subscribe(value => persistString(STORAGE_KEY, JSON.stringify(value)))

export function setModelPreset(provider: string, model: string, preset: ModelPreset): void {
  const key = modelPresetKey(provider, model)
  $modelPresets.set({ ...$modelPresets.get(), [key]: preset })
}

export function getModelPreset(provider: string, model: string): ModelPreset | undefined {
  return $modelPresets.get()[modelPresetKey(provider, model)]
}

export function clearModelPreset(provider: string, model: string): void {
  const key = modelPresetKey(provider, model)
  const next = { ...$modelPresets.get() }
  delete next[key]
  $modelPresets.set(next)
}
