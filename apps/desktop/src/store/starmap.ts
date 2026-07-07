import { atom } from 'nanostores'

import type { LearningNodeDetail, StarmapGraph } from '@/global.d'

// ── Atoms ──────────────────────────────────────────────────────────────────
export const $starmapGraph = atom<StarmapGraph | null>(null)
export const $starmapLoading = atom(true)
export const $starmapError = atom<string | null>(null)

// ── Load ────────────────────────────────────────────────────────────────────
export async function loadStarmapGraph(): Promise<void> {
  $starmapLoading.set(true)
  $starmapError.set(null)

  try {
    // The learning graph is served over the desktop HTTP bridge (FastAPI
    // route /api/learning/graph), NOT the JSON-RPC gateway — so we call it
    // through window.anakotDesktop.api(), which is how the rest of the app
    // fetches data. gateway.request() would hit "unknown method".
    const data = await window.anakotDesktop.api<StarmapGraph>({
      path: '/api/learning/graph'
    })

    if (!data?.nodes || !Array.isArray(data.nodes)) {
      throw new Error('Invalid graph data structure')
    }

    $starmapGraph.set(data)
    $starmapError.set(null)
  } catch (err) {
    $starmapError.set(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    $starmapLoading.set(false)
  }
}

// ── Node detail (GET /api/learning/node) ───────────────────────────────────
const _learningNodeCache = new Map<string, LearningNodeDetail>()

export async function getLearningNode(id: string): Promise<LearningNodeDetail | { ok: false; error?: string }> {
  const cached = _learningNodeCache.get(id)
  if (cached) return cached

  try {
    const res = await window.anakotDesktop.api<LearningNodeDetail>({
      path: `/api/learning/node?id=${encodeURIComponent(id)}`
    })
    if (res?.ok) {
      _learningNodeCache.set(id, res)
      return res
    }
    return { ok: false, error: res?.error ?? 'Node not found' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Request failed' }
  }
}

// ── Delete node (DELETE /api/learning/node) ────────────────────────────────
export async function deleteLearningNode(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await window.anakotDesktop.api<{ ok: boolean; error?: string }>({
      path: '/api/learning/node',
      method: 'DELETE',
      body: { id }
    })
    if (res?.ok) {
      _learningNodeCache.delete(id)
      evictStarmapNode(id)
      return { ok: true }
    }
    return { ok: false, error: res?.error ?? 'Delete failed' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

// ── Edit node (PUT /api/learning/node) ─────────────────────────────────────
export async function editLearningNode(
  id: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await window.anakotDesktop.api<{ ok: boolean; error?: string }>({
      path: '/api/learning/node',
      method: 'PUT',
      body: { id, content }
    })
    if (res?.ok) {
      _learningNodeCache.delete(id)
      return { ok: true }
    }
    return { ok: false, error: res?.error ?? 'Edit failed' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Edit failed' }
  }
}

// ── Evict (remove from cache, not from backend) ────────────────────────────
const _evicted = new Set<string>()

export function evictStarmapNode(id: string): void {
  _evicted.add(id)

  const graph = $starmapGraph.get()
  if (!graph) return

  $starmapGraph.set({
    ...graph,
    nodes: graph.nodes.filter(n => n.id !== id),
    edges: graph.edges.filter(e => e.source !== id && e.target !== id)
  })
}

export function resetStarmapGraph(): void {
  $starmapGraph.set(null)
  $starmapLoading.set(true)
  $starmapError.set(null)
  _evicted.clear()
}
