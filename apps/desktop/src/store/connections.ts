import { atom } from 'nanostores'

export type ConnectionKind = 'local' | 'remote' | 'ssh'

export interface Connection {
  id: string
  kind: ConnectionKind
  label: string
  url?: string
  host?: string
  isPrimary?: boolean
  lastUsed?: number
}

export interface ConnectionsRegistry {
  connections: Connection[]
  activeId: string | null
}

export const $connectionsRegistry = atom<ConnectionsRegistry>({
  connections: [],
  activeId: null
})

export const $connectionsLoading = atom(true)

function generateId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function loadConnectionsRegistry(): Promise<void> {
  $connectionsLoading.set(true)
  try {
    const result = await window.anakotDesktop?.connections?.list()
    if (result?.ok) {
      $connectionsRegistry.set({
        connections: result.registry?.connections || [],
        activeId: result.registry?.activeId || null
      })
    }
  } catch {
    // Use defaults
  } finally {
    $connectionsLoading.set(false)
  }
}

export async function saveConnection(connection: Omit<Connection, 'id'> & { id?: string }): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.connections?.save({
      ...connection,
      id: connection.id || generateId()
    })
    if (result?.ok) {
      await loadConnectionsRegistry()
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function removeConnection(id: string): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.connections?.remove(id)
    if (result?.ok) {
      await loadConnectionsRegistry()
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function setPrimaryConnection(id: string): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.connections?.setPrimary(id)
    if (result?.ok) {
      await loadConnectionsRegistry()
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function probeConnection(url: string): Promise<{ ok: boolean; reachable: boolean; error?: string }> {
  try {
    const result = await window.anakotDesktop?.connections?.probe({ url })
    return { ok: true, reachable: result?.reachable ?? false, error: result?.error }
  } catch (err) {
    return { ok: false, reachable: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function newConnection(kind: ConnectionKind): Connection {
  return {
    id: generateId(),
    kind,
    label: kind === 'local' ? 'Local' : kind === 'ssh' ? 'SSH Connection' : 'Remote API',
    url: kind === 'remote' ? 'https://' : undefined,
    host: kind === 'ssh' ? 'user@host' : undefined,
    isPrimary: false
  }
}
