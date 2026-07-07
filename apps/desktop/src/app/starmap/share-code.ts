import type { StarmapEdge, StarmapGraph, StarmapNode } from '@/global.d'

// ── Simplified share-code — JSON-based, no binary loadout ───────────────────
// The upstream Hermes uses a custom binary codec (@/lib/loadout). We replace it
// with plain JSON + base64url so there are zero new dependencies. Exported types
// match the upstream API shape.

export class ShareCodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareCodeError'
  }
}

// Mirror the upstream encodeShape for compatibility. Nodes store: kind, position
// (as 2× float32), radius inputs, interned label + category.
function encodeNode(n: StarmapNode) {
  return {
    c: n.category,
    i: n.id,
    k: n.kind,
    l: n.label,
    p: n.pinned ?? false,
    // position is reconstructed from time/rec when imported
    s: n.state ?? 'active',
    u: n.useCount ?? 0
  }
}

interface EncodedEdge {
  s: string
  t: string
}

function encodeEdge(e: StarmapEdge): EncodedEdge {
  return { s: e.source, t: e.target }
}

interface EncodedGraph {
  edges: EncodedEdge[]
  nodes: ReturnType<typeof encodeNode>[]
  v: number // version
}

/** Encode a star-map graph to a shareable base64url string. */
export function encodeShareCode(graph: StarmapGraph): string {
  const body: EncodedGraph = {
    edges: graph.edges.map(encodeEdge),
    nodes: graph.nodes.map(encodeNode),
    v: 1
  }

  const json = JSON.stringify(body)

  // base64url via UTF-8 (btoa fails on non-Latin1 characters)
  const utf8 = new TextEncoder().encode(json)
  const binary = String.fromCharCode(...utf8)
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `starmap-v1-${b64}`
}

/** Decode a share code back into the graph shape. */
export function decodeShareCode(code: string): StarmapGraph {
  const prefix = 'starmap-v1-'

  if (!code.startsWith(prefix)) {
    throw new ShareCodeError('Invalid share code format')
  }

  let json: string

  try {
    const b64 = code.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const latin1 = atob(padded)
    // Convert Latin1 back to UTF-8 (btoa/atob only handle single-byte chars)
    const bytes = new Uint8Array(latin1.length)
    for (let i = 0; i < latin1.length; i++) bytes[i] = latin1.charCodeAt(i)
    json = new TextDecoder().decode(bytes)
  } catch {
    throw new ShareCodeError('Failed to decode base64')
  }

  let body: EncodedGraph

  try {
    body = JSON.parse(json)
  } catch {
    throw new ShareCodeError('Invalid share code payload')
  }

  if (!body.nodes || !Array.isArray(body.nodes)) {
    throw new ShareCodeError('Missing nodes in share code')
  }

  const nodes: StarmapNode[] = body.nodes.map(n => ({
    category: n.c ?? '',
    createdBy: 'user' as const,
    id: n.i,
    kind: n.k,
    label: n.l,
    pinned: n.p,
    state: n.s,
    timestamp: 0, // will be reconstructed in the layout
    useCount: n.u
  }))

  const edges: StarmapEdge[] = body.edges.map(e => ({
    source: e.s,
    target: e.t
  }))

  return {
    nodes,
    edges,
    clusters: [],
    memory: [],
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      memories: nodes.filter(n => n.kind === 'memory').length,
      skills: nodes.filter(n => n.kind === 'skill').length,
      linked_nodes: 0,
    },
  }
}

/** Detect whether a string looks like a share code. */
export function looksLikeShareCode(text: string): boolean {
  return /^starmap-v1-[A-Za-z0-9_-]{10,}$/.test(text.trim())
}
