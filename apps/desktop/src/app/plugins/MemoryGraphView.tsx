// @ts-nocheck — deprecated; replaced by StarmapView from @/app/starmap
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { $sidebarOpen } from '@/store/layout'
import { loadStarmapGraph, getLearningNode, $starmapGraph, $starmapLoading, $starmapError } from '@/store/starmap'
import type { StarmapGraph, StarmapNode, LearningNodeDetail } from '@/global.d'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RING_OUTER = 280
const RING_INNER = 40
const LEAD_IN = 0.06
const SWEEP_MS = 15000
const GENTLE = 0.45
const ZOOM_MIN = 0.35
const ZOOM_MAX = 6
const BUCKET_COUNT = 48
const MAX_STARS_PER_BUCKET = 7

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SimNode extends SimulationNodeDatum {
  id: string
  label: string
  kind: 'memory' | 'skill'
  radius: number
  opacity: number
  useCount: number
  color: string
  revealRatio: number  // 0 (oldest) .. 1 (newest)
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  opacity: number
}

interface Viewport {
  x: number
  y: number
  k: number
}

interface TimeBucket {
  memory: number
  skill: number
  total: number
}

interface TimeAxis {
  buckets: TimeBucket[]
  maxTotal: number
  size: number
}

interface Palette {
  bgGradient: [string, string]
  ringColor: string
  edgeColor: string
  memoryColor: string
  skillColor: string
  memoryFill: string
  skillFill: string
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
function cineEase(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  const smooth = u * u * (3 - 2 * u)
  return GENTLE * u + (1 - GENTLE) * smooth
}

function invCineEase(y: number): number {
  let lo = 0; let hi = 1
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    if (cineEase(mid) < y) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function recForRatio(ratio: number): number {
  return LEAD_IN + (1 - LEAD_IN) * Math.max(0, Math.min(1, ratio))
}

// ---------------------------------------------------------------------------
// Recency computation
// ---------------------------------------------------------------------------
function computeRecency(nodes: StarmapNode[]): Map<string, number> {
  const known = nodes
    .map(n => (typeof n.timestamp === 'number' && Number.isFinite(n.timestamp) ? n.timestamp : null))
    .filter((v): v is number => v !== null)
  const minTs = known.length ? Math.min(...known) : null
  const maxTs = known.length ? Math.max(...known) : null
  const timed = minTs !== null && maxTs !== null && maxTs > minTs

  const ordered = [...nodes].sort((a, b) => {
    const at = typeof a.timestamp === 'number' ? a.timestamp : Infinity
    const bt = typeof b.timestamp === 'number' ? b.timestamp : Infinity
    return at === bt ? a.id.localeCompare(b.id) : at - bt
  })
  const ordRatio = new Map(ordered.map((n, i) => [n.id, ordered.length > 1 ? i / (ordered.length - 1) : 0]))
  const rec = new Map<string, number>()
  for (const n of nodes) {
    const ratio =
      timed && typeof n.timestamp === 'number' && minTs !== null && maxTs !== null
        ? (n.timestamp - minTs) / (maxTs - minTs)
        : (ordRatio.get(n.id) ?? 0)
    rec.set(n.id, recForRatio(ratio))
  }
  return rec
}

function buildTimeAxis(graph: StarmapGraph): TimeAxis {
  const rec = computeRecency(graph.nodes)
  const n = Math.max(1, BUCKET_COUNT)
  const buckets: TimeBucket[] = Array.from({ length: n }, () => ({ memory: 0, skill: 0, total: 0 }))
  for (const node of graph.nodes) {
    const r = rec.get(node.id) ?? 0
    const idx = Math.min(Math.floor(r * n), n - 1)
    const b = buckets[idx]
    b.total += 1
    if (node.kind === 'memory') b.memory += 1; else b.skill += 1
  }
  const maxTotal = buckets.reduce((m, b) => Math.max(m, b.total), 0)
  return { buckets, maxTotal, size: graph.nodes.length }
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
function computePalette(dark: boolean): Palette {
  return {
    bgGradient: dark ? ['#0a0a0f', '#111118'] : ['#f0f0f5', '#e8e8ef'],
    ringColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    edgeColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    memoryColor: dark ? '#ff6b6b' : '#e03131',
    skillColor: dark ? '#69db7c' : '#2f9e44',
    memoryFill: dark ? 'rgba(255,107,107,0.15)' : 'rgba(224,49,49,0.15)',
    skillFill: dark ? 'rgba(105,219,124,0.15)' : 'rgba(47,158,68,0.15)',
  }
}

// ---------------------------------------------------------------------------
// buildSimulation
// ---------------------------------------------------------------------------
function buildSimulation(
  graph: StarmapGraph,
  width: number,
  height: number,
  palette: Palette,
): { simNodes: SimNode[]; simLinks: SimLink[]; sim: Simulation<SimNode, undefined> } {
  const rec = computeRecency(graph.nodes)

  const simNodes: SimNode[] = graph.nodes.map(node => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    radius: Math.max(3, Math.min(10, 3 + (node.useCount || 0) * 0.5)),
    opacity: 1,
    useCount: node.useCount,
    color: node.kind === 'memory' ? palette.memoryColor : palette.skillColor,
    revealRatio: rec.get(node.id) ?? 0,
    x: (Math.random() - 0.5) * 50,
    y: (Math.random() - 0.5) * 50,
  }))

  const nodeMap = new Map(simNodes.map(n => [n.id, n]))
  const simLinks: SimLink[] = graph.edges
    .map(e => {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      return s && t ? { source: s, target: t, opacity: 0.3 } : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  // FNV-1a hash for stable random positioning
  function hash(input: string): number {
    let h = 2166136261
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  // Place each node at a stable angle determined by id hash
  for (const n of simNodes) {
    const angle = ((hash(n.id) % 3600) / 3600) * Math.PI * 2
    const tr = recForRatio(n.revealRatio) * RING_OUTER + RING_INNER
    n.x = Math.cos(angle) * tr
    n.y = Math.sin(angle) * tr
  }

  const sim = forceSimulation(simNodes)
    .force('radial', forceRadial(d => recForRatio(d.revealRatio) * RING_OUTER + RING_INNER, 0, 0))
    .force('charge', forceManyBody().strength(-30))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide<SimNode>().radius(d => d.radius + 2))
    .alphaDecay(0.02)
    .stop()

  // Run enough ticks to settle
  for (let i = 0; i < 120; i++) sim.tick()

  return { simNodes, simLinks, sim }
}

// ---------------------------------------------------------------------------
// Canvas render
// ---------------------------------------------------------------------------
function drawScene(
  ctx: CanvasRenderingContext2D,
  simNodes: SimNode[],
  simLinks: SimLink[],
  width: number,
  height: number,
  dpr: number,
  palette: Palette,
  viewport: Viewport,
  reveal: number,
) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width * dpr, height * dpr)

  // 1. Background — scale by dpr for crisp rendering
  const grad = ctx.createRadialGradient(
    (width / 2) * dpr, (height / 2) * dpr, 0,
    (width / 2) * dpr, (height / 2) * dpr, Math.max(width, height) * 0.7 * dpr,
  )
  grad.addColorStop(0, palette.bgGradient[0])
  grad.addColorStop(1, palette.bgGradient[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width * dpr, height * dpr)

  // 2. Apply viewport transform (CSS-pixel space)
  ctx.translate(viewport.x * dpr, viewport.y * dpr)
  ctx.scale(viewport.k * dpr, viewport.k * dpr)

  // 3. Rings (centered at simulation origin 0,0)
  ctx.strokeStyle = palette.ringColor
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const ringR = RING_INNER + (i / 5) * RING_OUTER
    ctx.beginPath()
    ctx.arc(0, 0, ringR, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 4. Edges (faded by reveal)
  ctx.strokeStyle = palette.edgeColor
  ctx.lineWidth = 0.5
  for (const link of simLinks) {
    const s = link.source as SimNode
    const t = link.target as SimNode
    if (!s || !t || !s.x || !t.x || !s.y || !t.y) continue
    const minReveal = Math.min(s.revealRatio, t.revealRatio)
    if (reveal < minReveal) continue
    ctx.globalAlpha = link.opacity * Math.min(1, (reveal - minReveal) / 0.05)
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(t.x, t.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 5. Nodes
  for (const node of simNodes) {
    if (!node.x || !node.y) continue
    if (reveal < node.revealRatio) continue
    const fadeIn = Math.min(1, (reveal - node.revealRatio) / 0.03)
    ctx.globalAlpha = fadeIn
    ctx.fillStyle = node.color

    if (node.kind === 'memory') {
      // Diamond
      const r = node.radius
      ctx.beginPath()
      ctx.moveTo(node.x, node.y - r)
      ctx.lineTo(node.x + r, node.y)
      ctx.lineTo(node.x, node.y + r)
      ctx.lineTo(node.x - r, node.y)
      ctx.closePath()
      ctx.fill()
    } else {
      // Circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function MemoryGraphView({ onBack }: { onBack?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const graph = useStore($starmapGraph)
  const loading = useStore($starmapLoading)
  const error = useStore($starmapError)
  const sidebarOpen = useStore($sidebarOpen)

  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [playState, setPlayState] = useState<'stopped' | 'playing'>('stopped')
  const [reveal, setReveal] = useState(1)  // 0..1, 1 = fully visible
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<LearningNodeDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const simRef = useRef<Simulation<SimNode, undefined> | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const simLinksRef = useRef<SimLink[]>([])
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, k: 1 })
  const paletteRef = useRef<Palette>(computePalette(true))
  const animRef = useRef<number | null>(null)
  const playStartRef = useRef(0)
  const revealStartRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const axisRef = useRef<TimeAxis | null>(null)
  const dirtyRef = useRef(true)
  const revealRef = useRef(1)
  const dprRef = useRef(1)

  // Sync reveal ref for animation loop
  useEffect(() => {
    revealRef.current = reveal
  }, [reveal])

  // Fetch data on mount
  useEffect(() => {
    loadStarmapGraph()
  }, [])

  // Rebuild palette on theme change
  useEffect(() => {
    paletteRef.current = computePalette(dark)
    dirtyRef.current = true
  }, [dark])

  // Dimensions observer
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
  }, [])

  useEffect(() => {
    updateDimensions()
    const ro = new ResizeObserver(updateDimensions)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [updateDimensions, sidebarOpen])

  // DPR-aware canvas sizing (separate from layout dimensions)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(dimensions.width * dpr)
    canvas.height = Math.round(dimensions.height * dpr)
    canvas.style.width = `${dimensions.width}px`
    canvas.style.height = `${dimensions.height}px`
    dprRef.current = dpr
    dirtyRef.current = true
  }, [dimensions])

  // Rebuild simulation when graph data or dimensions change
  useEffect(() => {
    if (!graph) return
    dirtyRef.current = true
    const pal = paletteRef.current
    const { simNodes, simLinks, sim } = buildSimulation(graph, dimensions.width, dimensions.height, pal)
    simNodesRef.current = simNodes
    simLinksRef.current = simLinks
    simRef.current = sim
    axisRef.current = buildTimeAxis(graph)

    // Fit viewport: simulation origin (0,0) maps to canvas center (w/2, h/2)
    // after translate(vp.x, vp.y) + scale(k). So vp.x = w/2, vp.y = h/2.
    const scale = Math.min(dimensions.width / (RING_OUTER * 2 + 80), dimensions.height / (RING_OUTER * 2 + 80))
    viewportRef.current = { x: dimensions.width / 2, y: dimensions.height / 2, k: scale }

    return () => { sim.stop() }
  }, [graph, dimensions])

  // Animation loop
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const canvas = canvasRef.current
      if (!canvas) { animRef.current = requestAnimationFrame(loop); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { animRef.current = requestAnimationFrame(loop); return }

      // Render
      drawScene(
        ctx,
        simNodesRef.current,
        simLinksRef.current,
        dimensions.width,
        dimensions.height,
        dprRef.current,
        paletteRef.current,
        viewportRef.current,
        revealRef.current,
      )

      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [dimensions])

  // Playback logic
  const togglePlay = useCallback(() => {
    if (playState === 'playing') {
      setPlayState('stopped')
    } else {
      revealStartRef.current = revealRef.current
      playStartRef.current = performance.now()
      setPlayState('playing')
    }
  }, [playState])

  useEffect(() => {
    if (playState !== 'playing') return
    const start = playStartRef.current
    const fromReveal = revealStartRef.current
    const remaining = (1 - fromReveal) * SWEEP_MS * (1 / cineEase(1)) // scale to remaining time
    // Actually simpler: just compute progress from start
    let running = true
    const tick = () => {
      if (!running) return
      const elapsed = performance.now() - start
      const rawProgress = elapsed / SWEEP_MS
      const easedProgress = fromReveal + (1 - fromReveal) * Math.min(1, cineEase(rawProgress))
      if (easedProgress >= 1) {
        setReveal(1)
        setPlayState('stopped')
        return
      }
      setReveal(easedProgress)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => { running = false }
  }, [playState])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const vp = viewportRef.current
    const delta = -e.deltaY * 0.001
    const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vp.k * (1 + delta)))
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    viewportRef.current = {
      x: mx - (mx - vp.x) * (newK / vp.k),
      y: my - (my - vp.y) * (newK / vp.k),
      k: newK,
    }
  }, [])

  // Pan (drag)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    viewportRef.current = {
      x: viewportRef.current.x + dx,
      y: viewportRef.current.y + dy,
      k: viewportRef.current.k,
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // Scrub
  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setReveal(v)
    setPlayState('stopped')
  }, [])

  // Build histogram stars for timeline
  const stars = useMemo(() => {
    const axis = axisRef.current
    if (!axis) return []
    const total = axis.maxTotal || 1
    const result: Array<{ kind: string; opacity: number; pct: number }> = []
    for (const [i, b] of axis.buckets.entries()) {
      if (b.total === 0) continue
      const intensity = b.total / total
      const count = Math.max(1, Math.ceil(intensity * MAX_STARS_PER_BUCKET))
      const pct = ((i + 0.5) / BUCKET_COUNT) * 100
      const skillCount = Math.round((b.skill / b.total) * count)
      for (let s = 0; s < count; s++) {
        result.push({
          kind: s < skillCount ? 'skill' : 'memory',
          opacity: 0.3 + intensity * 0.5,
          pct,
        })
      }
    }
    return result
  }, [graph])

  // Hover detection: convert mouse to simulation coordinates
  const handleCanvasHover = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const vp = viewportRef.current
    // Simulation coords = (mouseCSS - viewportOffset) / zoom
    const simX = (e.clientX - rect.left - vp.x) / vp.k
    const simY = (e.clientY - rect.top - vp.y) / vp.k

    let closest: SimNode | null = null
    let closestDist = 20 // threshold in simulation units
    for (const node of simNodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      const dx = node.x - simX
      const dy = node.y - simY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist) {
        closestDist = dist
        closest = node
      }
    }
    setHoveredNode(closest)
  }, [dimensions])

  // Click to select node and show detail
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    // Ignore clicks that were actually the end of a drag
    if (isDraggingRef.current) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const vp = viewportRef.current
    const simX = (e.clientX - rect.left - vp.x) / vp.k
    const simY = (e.clientY - rect.top - vp.y) / vp.k

    let closest: SimNode | null = null
    let closestDist = 20
    for (const node of simNodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      const dx = node.x - simX
      const dy = node.y - simY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist) {
        closestDist = dist
        closest = node
      }
    }

    if (closest) {
      // If clicking same node, close it
      if (selectedNodeId === closest.id) {
        setSelectedNodeId(null)
        setSelectedNodeDetail(null)
        return
      }
      setSelectedNodeId(closest.id)
      setSelectedNodeDetail(null)
      setLoadingDetail(true)
      setDetailError(null)
      try {
        const detail = await getLearningNode(closest.id)
        setSelectedNodeDetail(detail)
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoadingDetail(false)
      }
    } else {
      setSelectedNodeId(null)
      setSelectedNodeDetail(null)
    }
  }, [dimensions, selectedNodeId])

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-none p-4 pb-0">
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            onClick={onBack}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold tracking-tight">Memory Graph</h1>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-red-400">Failed to load memory graph</p>
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">{error}</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-[var(--dt-primary)] px-4 py-1.5 text-xs text-white cursor-pointer"
              onClick={() => loadStarmapGraph(true)}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || !graph) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-none p-4 pb-0">
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            onClick={onBack}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold tracking-tight">Memory Graph</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading memory graph...
          </div>
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-none p-4 pb-0">
        <button
          type="button"
          className="mb-2 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          onClick={onBack}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold tracking-tight">Memory Graph</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          {graph.stats?.nodes ?? 0} memories and skills over time
        </p>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseMove={handleCanvasHover}
          onClick={handleCanvasClick}
        />

        {/* Node detail panel */}
        {(selectedNodeDetail || loadingDetail) && (
          <div className="absolute right-2 top-2 w-80 max-h-[calc(100%-1rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl z-10">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {selectedNodeDetail?.kind === 'memory' ? 'Memory' : 'Skill'}
              </span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-hover-bg)] hover:text-[var(--color-text-primary)] cursor-pointer"
                onClick={() => { setSelectedNodeId(null); setSelectedNodeDetail(null) }}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3">
              {loadingDetail ? (
                <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-tertiary)]">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              ) : selectedNodeDetail ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
                    {selectedNodeDetail.label}
                  </h3>
                  <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded bg-[var(--color-bg-secondary)] p-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)] font-mono">
                    {selectedNodeDetail.content}
                  </pre>
                  {selectedNodeDetail.kind === 'skill' && (
                    <div className="flex gap-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-500/15 text-green-400">
                        Skill
                      </span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/15 text-blue-400">
                        {selectedNodeDetail.id}
                      </span>
                    </div>
                  )}
                </div>
              ) : detailError ? (
                <p className="text-xs text-red-400">{detailError}</p>
              ) : null}
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredNode && !selectedNodeId && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs text-[var(--color-text-secondary)] shadow-lg">
            {hoveredNode.label}
          </div>
        )}

      </div>

      {/* Timeline scrubber */}
      <div className="flex-none border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Play button */}
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-bg)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            onClick={togglePlay}
            title={playState === 'playing' ? 'Pause' : 'Play'}
          >
            {playState === 'playing' ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            )}
          </button>

          {/* Histogram scrubber */}
          <div className="relative flex-1">
            <div className="flex h-8 items-end gap-px">
              {(axisRef.current?.buckets ?? []).map((b, i) => {
                const h = axisRef.current?.maxTotal ? (b.total / axisRef.current.maxTotal) * 28 : 0
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: Math.max(2, h),
                      background: b.memory > b.skill
                        ? 'var(--dt-primary, #0053fd)'
                        : 'var(--color-accent, #69db7c)',
                      opacity: 0.5 + (b.total / Math.max(1, axisRef.current?.maxTotal ?? 1)) * 0.5,
                    }}
                  />
                )
              })}
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={reveal}
              onChange={handleScrub}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          {/* Reveal label */}
          <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {Math.round(reveal * (axisRef.current?.size || 1))} / {axisRef.current?.size ?? 0}
          </span>
        </div>

        {/* Stats bar */}
        {graph && (
          <div className="mt-2 flex gap-3 text-[10px] text-[var(--color-text-tertiary)]">
            <span>{graph.stats?.nodes ?? 0} nodes</span>
            <span>{graph.stats?.edges ?? 0} edges</span>
            <span>{graph.stats?.memories ?? 0} memories</span>
            <span>{graph.stats?.skills ?? 0} skills</span>
          </div>
        )}
      </div>
    </div>
  )
}
