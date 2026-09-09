import { atom } from 'nanostores'

import type { StarmapGraph } from '@/global.d'

// ── Atoms ────────────────────────────────────────────────────────────────
export const $starmapGraph = atom<StarmapGraph | null>(null)
export const $starmapLoading = atom(false)
export const $starmapError = atom<null | string>(null)

// ── In-flight dedup ──────────────────────────────────────────────────────
let inflight: Promise<void> | null = null

// ── Load ────────────────────────────────────────────────────────────────
export async function loadStarmapGraph(force = false): Promise<void> {
  if (inflight) {
    return inflight
  }

  if ($starmapGraph.get() && !force) {
    return
  }

  $starmapLoading.set(true)
  $starmapError.set(null)

  inflight = (async () => {
    try {
      const data = await window.anakotDesktop.api<StarmapGraph>({
        path: '/api/learning/graph'
      })
      $starmapGraph.set(data)
    } catch (err) {
      $starmapError.set(err instanceof Error ? err.message : String(err))
    } finally {
      $starmapLoading.set(false)
      inflight = null
    }
  })()

  return inflight
}

// ── Evict Node ───────────────────────────────────────────────────────────
export function evictStarmapNode(id: string): () => void {
  const prev = $starmapGraph.get()
  if (!prev) return () => {}

  const next: StarmapGraph = {
    ...prev,
    nodes: prev.nodes.filter(node => node.id !== id),
    edges: prev.edges.filter(e => e.source !== id && e.target !== id)
  }

  $starmapGraph.set(next)
  return () => $starmapGraph.set(prev)
}

// ── Mutations ───────────────────────────────────────────────────────────
export async function editLearningNode(
  id: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await window.anakotDesktop.api({
      path: `/api/learning/node/${encodeURIComponent(id)}`,
      method: 'PUT',
      body: { content },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function deleteLearningNode(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await window.anakotDesktop.api({
      path: `/api/learning/node/${encodeURIComponent(id)}`,
      method: 'DELETE',
    })
    evictStarmapNode(id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Reset ───────────────────────────────────────────────────────────────
export function resetStarmapGraph(): void {
  inflight = null
  $starmapGraph.set(null)
}