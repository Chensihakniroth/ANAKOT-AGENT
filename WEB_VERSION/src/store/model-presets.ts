import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const PRESETS_STORAGE_KEY = 'anakot.desktop.modelPresets'

/**
 * Per-model preset: overrides applied automatically when a model is selected.
 * Both fields are optional — absent values leave the gateway default.
 */
export interface ModelPreset {
  /**
   * System prompt override for this model (appended or replacing the default).
   * Empty string = no override.
   */
  systemPrompt: string
  /**
   * Temperature override (0–2). 0 means "no override / use gateway default".
   */
  temperature: number
}

function loadPresets(): Record<string, ModelPreset> {
  const raw = storedString(PRESETS_STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const cleaned: Record<string, ModelPreset> = {}

      for (const [key, value] of Object.entries(parsed)) {
        const v = value as Partial<ModelPreset>

        if (v && typeof v === 'object') {
          cleaned[key] = {
            systemPrompt: typeof v.systemPrompt === 'string' ? v.systemPrompt : '',
            temperature: typeof v.temperature === 'number' ? Math.min(2, Math.max(0, v.temperature)) : 0
          }
        }
      }

      return cleaned
    }
  } catch {
    // Corrupted storage → start fresh.
  }

  return {}
}

/** Persisted per-model preset overrides, keyed by model id. */
export const $modelPresets = atom<Record<string, ModelPreset>>(loadPresets())

$modelPresets.subscribe(value => {
  persistString(PRESETS_STORAGE_KEY, JSON.stringify(value))
})

/** Read a single model's preset, or undefined if none is stored. */
export function getModelPreset(model: string): ModelPreset | undefined {
  return $modelPresets.get()[model]
}

/** Store (or replace) a preset for a model. */
export function setModelPreset(model: string, preset: ModelPreset): void {
  const next = { ...$modelPresets.get(), [model]: preset }
  $modelPresets.set(next)
}

/** Remove any stored preset for a model. */
export function clearModelPreset(model: string): void {
  const current = $modelPresets.get()

  if (!(model in current)) {
    return
  }

  const next = { ...current }
  delete next[model]
  $modelPresets.set(next)
}
