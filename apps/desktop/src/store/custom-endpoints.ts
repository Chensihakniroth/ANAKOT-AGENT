import { atom } from 'nanostores'

export interface CustomEndpoint {
  id: string
  name: string
  base_url: string
  api_key?: string
  model?: string
  context_length?: number
  discover_models?: boolean
  is_current?: boolean
}

export const $customEndpoints = atom<CustomEndpoint[]>([])
export const $customEndpointsLoading = atom(true)

function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function loadCustomEndpoints(): Promise<void> {
  $customEndpointsLoading.set(true)
  try {
    const { getAnakotConfigRecord } = await import('@/anakot')
    const config = await getAnakotConfigRecord()
    const providers = (config?.custom_providers as CustomEndpoint[]) || []
    $customEndpoints.set(providers.map(p => ({ ...p, id: p.id || generateId() })))
  } catch {
    $customEndpoints.set([])
  } finally {
    $customEndpointsLoading.set(false)
  }
}

export async function saveCustomEndpoint(endpoint: CustomEndpoint): Promise<boolean> {
  try {
    const { getAnakotConfigRecord, saveAnakotConfig } = await import('@/anakot')
    const config = await getAnakotConfigRecord()
    const providers: CustomEndpoint[] = ((config?.custom_providers as CustomEndpoint[]) || []).map(p => ({
      ...p,
      id: p.id || generateId()
    }))

    const existingIndex = providers.findIndex(p => p.id === endpoint.id)
    if (existingIndex >= 0) {
      providers[existingIndex] = endpoint
    } else {
      providers.push({ ...endpoint, id: endpoint.id || generateId() })
    }

    await saveAnakotConfig({ ...config, custom_providers: providers })
    await loadCustomEndpoints()
    return true
  } catch {
    return false
  }
}

export async function deleteCustomEndpoint(id: string): Promise<boolean> {
  try {
    const { getAnakotConfigRecord, saveAnakotConfig } = await import('@/anakot')
    const config = await getAnakotConfigRecord()
    const providers: CustomEndpoint[] = ((config?.custom_providers as CustomEndpoint[]) || []).filter(p => p.id !== id)

    await saveAnakotConfig({ ...config, custom_providers: providers })
    await loadCustomEndpoints()
    return true
  } catch {
    return false
  }
}

export async function activateCustomEndpoint(id: string): Promise<boolean> {
  try {
    const { getAnakotConfigRecord, saveAnakotConfig } = await import('@/anakot')
    const config = await getAnakotConfigRecord()
    const providers: CustomEndpoint[] = ((config?.custom_providers as CustomEndpoint[]) || []).map(p => ({
      ...p,
      is_current: p.id === id
    }))

    await saveAnakotConfig({ ...config, custom_providers: providers })
    await loadCustomEndpoints()
    return true
  } catch {
    return false
  }
}

export function newCustomEndpoint(): CustomEndpoint {
  return {
    id: generateId(),
    name: '',
    base_url: '',
    api_key: '',
    model: '',
    context_length: undefined,
    discover_models: true,
    is_current: false
  }
}
