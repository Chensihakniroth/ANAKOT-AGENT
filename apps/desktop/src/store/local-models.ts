import { atom } from 'nanostores'

export interface LocalModel {
  id: string
  name: string
  size: string
  runtime: 'ollama' | 'llama.cpp'
  status: 'ready' | 'downloading' | 'not_downloaded'
  progress?: number
}

export interface LocalRuntime {
  name: string
  type: 'ollama' | 'llama.cpp'
  status: 'running' | 'stopped' | 'not_installed'
  version?: string
}

export const $localModels = atom<LocalModel[]>([])
export const $localRuntimes = atom<LocalRuntime[]>([])
export const $localModelsLoading = atom(true)

export async function loadLocalModels(): Promise<void> {
  $localModelsLoading.set(true)
  try {
    const result = await window.anakotDesktop?.localModels?.list()
    if (result?.ok) {
      $localModels.set((result.models || []) as LocalModel[])
      $localRuntimes.set((result.runtimes || []) as LocalRuntime[])
    }
  } catch {
    // Use defaults
  } finally {
    $localModelsLoading.set(false)
  }
}

export async function downloadModel(modelName: string): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.localModels?.download({ model: modelName })
    return result?.ok ?? false
  } catch {
    return false
  }
}

export async function deleteModel(modelId: string): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.localModels?.remove({ id: modelId })
    if (result?.ok) {
      await loadLocalModels()
    }
    return result?.ok ?? false
  } catch {
    return false
  }
}

export async function startRuntime(type: 'ollama' | 'llama.cpp'): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.localModels?.startRuntime({ type })
    if (result?.ok) {
      await loadLocalModels()
    }
    return result?.ok ?? false
  } catch {
    return false
  }
}

export async function stopRuntime(type: 'ollama' | 'llama.cpp'): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.localModels?.stopRuntime({ type })
    if (result?.ok) {
      await loadLocalModels()
    }
    return result?.ok ?? false
  } catch {
    return false
  }
}
