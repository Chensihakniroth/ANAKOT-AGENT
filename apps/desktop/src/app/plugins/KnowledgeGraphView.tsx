import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { forceX, forceY, forceZ } from 'd3-force-3d'
import { IconSettings, IconRotateClockwise as RefreshIcon, IconX as CloseIcon, IconChevronDown as ChevronDownIcon } from '@tabler/icons-react'

interface GraphNode {
  id: string
  name: string
  path: string
  group: string
  size: number
}

interface GraphLink {
  source: string
  target: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphSettings {
  showArrows: boolean
  nodeSize: number
  linkThickness: number
  centreForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
  labelsVisible: boolean
  d3AlphaDecay: number
  d3VelocityDecay: number
  containmentStrength: number
}

const GROUP_COLORS: Record<string, string> = {
  'Anakot Agent': '#00f0ff',
  'nile training': '#ff2975',
  'Daily Notes': '#f0e100',
  root: '#b829f0',
}

const FALLBACK_COLORS = [
  '#00f0ff', '#ff2975', '#b829f0', '#f0e100',
  '#00ff87', '#ff6b35', '#39ff14', '#ff00ff',
]

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span className={`relative inline-flex h-[18px] w-[32px] shrink-0 rounded-full border transition-all duration-300 ${
        value
          ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]'
          : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
      }`}>
        <span className={`pointer-events-none inline-block h-[14px] w-[14px] rounded-full transition-all duration-300 shadow-sm ${
          value
            ? 'translate-x-[14px] bg-[var(--color-accent)]'
            : 'translate-x-0 bg-[var(--color-text-tertiary)]/40'
        }`} />
      </span>
    </label>
  )
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={e => onChange(Number(e.target.value))}
      className="h-1 w-full cursor-pointer appearance-none rounded-full outline-none"
      style={{
        background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${pct}%, var(--color-bg-tertiary) ${pct}%, var(--color-bg-tertiary) 100%)`,
      }}
    />
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className="group" open={open}>
      <summary className="flex w-full items-center gap-1.5 py-1.5 text-xs font-mono tracking-wider text-[var(--color-text-tertiary)] list-none cursor-pointer hover:text-[var(--color-text-primary)] transition-colors" onClick={e => { e.preventDefault(); setOpen(!open) }}>
        <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${open ? 'text-[var(--color-accent)] rotate-0' : '-rotate-90 text-[var(--color-text-tertiary)]/50'}`} strokeWidth={2} />
        {'> '}{title}
      </summary>
      <div className="space-y-2 pb-2 pl-2 border-l border-[var(--color-border)]/50 ml-[5px]">{children}</div>
    </details>
  )
}

export function KnowledgeGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const zoomedRef = useRef(false)
  const mountedRef = useRef(true)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [appBgColor, setAppBgColor] = useState('#0f0f1a')
  const [settings, setSettings] = useState<GraphSettings>({
    showArrows: false,
    nodeSize: 4,
    linkThickness: 1,
    centreForce: 1.0,
    repelForce: -60,
    linkForce: 0.3,
    linkDistance: 60,
    labelsVisible: true,
    d3AlphaDecay: 0.02,
    d3VelocityDecay: 0.3,
    containmentStrength: 0.05,
  })

  // Shared Three.js geometries/materials for performance
  const sphereGeomRef = useRef<THREE.SphereGeometry | null>(null)
  const materialCacheRef = useRef<Map<string, THREE.MeshLambertMaterial>>(new Map())

  const getSphereGeometry = useCallback(() => {
    if (!sphereGeomRef.current) {
      sphereGeomRef.current = new THREE.SphereGeometry(1, 16, 12)
    }
    return sphereGeomRef.current
  }, [])

  const getNodeMaterial = useCallback((color: string) => {
    const cache = materialCacheRef.current
    let mat = cache.get(color)
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.9 })
      cache.set(color, mat)
    }
    return mat
  }, [])

  // Clean up Three.js resources on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (sphereGeomRef.current) sphereGeomRef.current.dispose()
      materialCacheRef.current.forEach(m => m.dispose())
      materialCacheRef.current.clear()
    }
  }, [])

  // Read app theme color for the Three.js WebGL background
  useEffect(() => {
    const el = document.documentElement
    const bg = getComputedStyle(el).getPropertyValue('--color-bg-primary').trim()
    if (bg) setAppBgColor(bg)
  }, [])

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }
  }, [])

  const getNodeColor = useCallback((node: GraphNode) => {
    return GROUP_COLORS[node.group] || FALLBACK_COLORS[node.id.charCodeAt(0) % FALLBACK_COLORS.length]
  }, [])

  const scanVault = useCallback(async () => {
    if (!vaultPath) { setError('No vault path set'); return }
    setLoading(true); setError(null)
    try {
      const result = await window.anakotDesktop.scanObsidianVault(vaultPath)
      if (!mountedRef.current) return
      if (result.ok) { setGraphData(result.graph); setError(null); setLastScanTime(new Date()); zoomedRef.current = false }
      else { setError(result.error || 'Unknown error'); setGraphData(null) }
    } catch (e) { if (mountedRef.current) { setError(String(e)); setGraphData(null) } }
    finally { if (mountedRef.current) setLoading(false) }
  }, [vaultPath])

  // --- Graph Data Loading ---

  useEffect(() => {
    updateSize()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => { observer.disconnect() }
  }, [updateSize])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!window?.anakotDesktop) { if (mounted) { setError('Desktop API not available'); setLoading(false) }; return }
      try {
        const config: any = await window.anakotDesktop.api({ path: '/api/config' })
        if (mounted) {
          const path = config?.obsidian?.vault_path ?? ''
          path ? setVaultPath(path) : (setError('No vault path set'), setVaultPath(''))
        }
      } catch (e) { if (mounted) { setError(String(e)); setVaultPath('') } }
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (vaultPath === null) return
    let mounted = true
    async function scan() {
      if (!window?.anakotDesktop) { if (mounted) { setError('Desktop API not available'); setLoading(false) }; return }
      if (!vaultPath) { if (mounted) { setGraphData(null); setError('No vault path set'); setLoading(false) }; return }
      setLoading(true); setError(null)
      try {
        const result = await window.anakotDesktop.scanObsidianVault(vaultPath)
        if (mounted) {
          if (result.ok) { setGraphData(result.graph); setError(null); setLastScanTime(new Date()); zoomedRef.current = false }
          else { setError(result.error || 'Unknown error'); setGraphData(null) }
        }
      } catch (e) { if (mounted) { setError(String(e)); setGraphData(null) } }
      finally { if (mounted) setLoading(false) }
    }
    scan()
    return () => { mounted = false }
  }, [vaultPath])

  // --- Forces ---

  // Apply force parameters when graph data loads (no reheat — ForceGraph3D
  // handles simulation startup internally, so reheating here races its init)
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !graphData) return

    const center = fg.d3Force('center')
    if (center) center.strength(settings.centreForce)

    const charge = fg.d3Force('charge')
    if (charge) charge.strength(settings.repelForce)

    const link = fg.d3Force('link')
    if (link) {
      link.distance(settings.linkDistance)
      link.strength(settings.linkForce)
    }

    // Register containment forces — rubber bands that pull nodes back
    // toward origin. Strength acts like max-distance limit: higher =
    // tighter boundary.
    fg.d3Force('x', forceX(0).strength(settings.containmentStrength))
    fg.d3Force('y', forceY(0).strength(settings.containmentStrength))
    fg.d3Force('z', forceZ(0).strength(settings.containmentStrength))
  }, [graphData])

  // Reheat simulation only when user tweaks force-related settings (safe
  // because initialization is already complete by the time they interact).
  // Display-only settings (showArrows, labelsVisible, nodeSize, linkThickness)
  // do NOT reheat — they're handled by ForceGraph3D props directly.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !graphData) return

    const center = fg.d3Force('center')
    if (center) center.strength(settings.centreForce)

    const charge = fg.d3Force('charge')
    if (charge) charge.strength(settings.repelForce)

    const link = fg.d3Force('link')
    if (link) {
      link.distance(settings.linkDistance)
      link.strength(settings.linkForce)
    }

    fg.d3ReheatSimulation()

    // Update containment forces to match slider (forces already registered
    // on initial load, but strength needs updating + reheat)
    const xForce = fg.d3Force('x')
    if (xForce) xForce.strength(settings.containmentStrength)
    const yForce = fg.d3Force('y')
    if (yForce) yForce.strength(settings.containmentStrength)
    const zForce = fg.d3Force('z')
    if (zForce) zForce.strength(settings.containmentStrength)
  }, [
    settings.centreForce,
    settings.repelForce,
    settings.linkForce,
    settings.linkDistance,
    settings.d3AlphaDecay,
    settings.d3VelocityDecay,
    settings.containmentStrength,
  ])

  // --- Helpers ---

  const handleRefresh = scanVault

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    document.body.style.cursor = node ? 'pointer' : 'default'
    setHoveredNode(node)
  }, [])

  const handleNodeDragEnd = useCallback((node: any) => {
    if (node) { node.fx = undefined; node.fy = undefined; node.fz = undefined }
    const fg = fgRef.current
    if (fg) {
      fg.d3ReheatSimulation()
    }
  }, [])

  const handleEngineStop = useCallback(() => {
    if (fgRef.current && !zoomedRef.current) {
      zoomedRef.current = true
      setTimeout(() => fgRef.current?.zoomToFit(400, 80), 100)
    }
  }, [])

  const nodeLabelFn = useCallback((node: GraphNode) => `${node.name}`, [])
  const nodeValFn = useCallback((node: GraphNode) => node.size ?? 1, [])
  const linkColorFn = useCallback(() => 'rgba(128, 128, 128, 0.15)', [])
  const linkArrowColorFn = useCallback(() => 'rgba(128, 128, 128, 0.3)', [])

  const forceGraphData = useMemo(() => ({
    nodes: graphData?.nodes ?? [],
    links: graphData?.links ?? [],
  }), [graphData])

  // --- 3D Node Renderer ---

  const nodeThreeObject = useCallback((node: GraphNode) => {
    const color = getNodeColor(node)
    const scale = Math.max(0.3, (node.size ?? 1) * (settings.nodeSize / 4) * 0.5)
    const geometry = getSphereGeometry()
    const material = getNodeMaterial(color)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(scale, scale, scale)
    return mesh
  }, [getSphereGeometry, getNodeMaterial, getNodeColor, settings.nodeSize])

  // --- Render States ---

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ width: '100%', height: '100%' }}>
      {/* Overlay: Loading — canvas preserved underneath */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
            <span className="text-sm text-[var(--color-text-secondary)] font-mono tracking-[0.15em] animate-pulse">SCANNING VAULT...</span>
          </div>
        </div>
      )}

      {/* Overlay: Error */}
      {error && !loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-lg font-mono text-[var(--color-destructive)] mb-2 tracking-[0.2em]">⚠ SYSTEM ERROR</div>
            <p className="text-sm text-[var(--color-destructive)]/80 font-mono">{error}</p>
            {vaultPath && (
              <div className="mt-5">
                <button onClick={handleRefresh} className="text-xs px-4 py-2 rounded border border-[var(--color-destructive)]/50 text-[var(--color-destructive)] font-mono tracking-[0.1em] bg-[var(--color-destructive)]/10 hover:bg-[var(--color-destructive)]/20 transition-all">RETRY</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Empty — no data, not loading, no error */}
      {(!graphData || graphData.nodes.length === 0) && !loading && !error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-sm">
          <div className="text-center">
            <span className="text-sm font-mono text-[var(--color-text-tertiary)]/70 tracking-[0.3em]">NO DATA</span>
            {vaultPath && <button onClick={handleRefresh} className="mt-5 text-xs px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] font-mono tracking-[0.1em] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-all">INITIALIZE SCAN</button>}
          </div>
        </div>
      )}
      {/* Top bar — Sci-fi HUD */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[var(--color-bg-primary)]/80 backdrop-blur-md border border-[var(--color-border)] shadow-sm">
        <button onClick={() => setShowSettings(s => !s)}
          className={`p-1.5 rounded-md transition-all ${
            showSettings
              ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
          title="Settings"
        >
          <IconSettings className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="w-px h-4 bg-[var(--color-border)]" />
        <button onClick={handleRefresh} className="text-xs px-2.5 py-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] bg-transparent hover:bg-[var(--color-bg-secondary)] transition-all font-mono tracking-wider" title="Rescan vault">
          <RefreshIcon className="h-3 w-3 inline mr-1.5" strokeWidth={2} />
          REFRESH
        </button>
        <div className="w-px h-4 bg-[var(--color-border)]" />
        <div className="flex items-center gap-3 font-mono text-[10px]">
          {lastScanTime && <span className="text-[var(--color-text-tertiary)]">{lastScanTime.toLocaleTimeString()}</span>}
          <span className="text-[var(--color-text-secondary)]">{graphData?.nodes.length ?? 0}<span className="text-[var(--color-text-tertiary)]">N</span> <span className="text-[var(--color-accent)]">{graphData?.links.length ?? 0}<span className="text-[var(--color-text-tertiary)]">E</span></span></span>
        </div>
      </div>

      {/* Settings panel — Sci-fi interface */}
      {showSettings && (
        <div className="absolute top-0 right-0 z-20 h-full w-[260px] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] backdrop-blur-2xl p-4 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <span className="text-sm font-mono tracking-[0.2em] text-[var(--color-text-secondary)]">CONTROLS</span>
            <button onClick={() => setShowSettings(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
              <CloseIcon className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <Section title="Display">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-primary)]">Labels</span>
              <Toggle value={settings.labelsVisible} onChange={v => setSettings(s => ({ ...s, labelsVisible: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-primary)]">Arrows</span>
              <Toggle value={settings.showArrows} onChange={v => setSettings(s => ({ ...s, showArrows: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Node size</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.nodeSize.toFixed(1)}</span></div>
              <Slider value={settings.nodeSize} min={1} max={20} step={0.5} onChange={v => setSettings(s => ({ ...s, nodeSize: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Link thickness</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.linkThickness.toFixed(1)}</span></div>
              <Slider value={settings.linkThickness} min={0.5} max={5} step={0.5} onChange={v => setSettings(s => ({ ...s, linkThickness: v }))} />
            </div>
          </Section>

          <Section title="Forces">
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Centre force</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.centreForce.toFixed(1)}</span></div>
              <Slider value={settings.centreForce} min={0} max={2} step={0.1} onChange={v => setSettings(s => ({ ...s, centreForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Repel force</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.repelForce}</span></div>
              <Slider value={settings.repelForce} min={-300} max={0} step={5} onChange={v => setSettings(s => ({ ...s, repelForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Link force</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.linkForce.toFixed(2)}</span></div>
              <Slider value={settings.linkForce} min={0} max={1} step={0.05} onChange={v => setSettings(s => ({ ...s, linkForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Link distance</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.linkDistance}</span></div>
              <Slider value={settings.linkDistance} min={10} max={300} step={5} onChange={v => setSettings(s => ({ ...s, linkDistance: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Alpha decay</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.d3AlphaDecay.toFixed(2)}</span></div>
              <Slider value={settings.d3AlphaDecay} min={0.001} max={0.1} step={0.005} onChange={v => setSettings(s => ({ ...s, d3AlphaDecay: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Velocity decay</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.d3VelocityDecay.toFixed(2)}</span></div>
              <Slider value={settings.d3VelocityDecay} min={0.1} max={0.9} step={0.05} onChange={v => setSettings(s => ({ ...s, d3VelocityDecay: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-text-primary)]">Containment</span><span className="text-[var(--color-text-tertiary)] text-[10px]">{settings.containmentStrength.toFixed(3)}</span></div>
              <Slider value={settings.containmentStrength} min={0} max={0.3} step={0.005} onChange={v => setSettings(s => ({ ...s, containmentStrength: v }))} />
            </div>
          </Section>
        </div>
      )}

      {/* 3D Graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={forceGraphData}
        width={containerSize.width}
        height={containerSize.height}
        backgroundColor={appBgColor}
        showNavInfo={false}
        nodeLabel={settings.labelsVisible ? nodeLabelFn : undefined}
        nodeColor={getNodeColor}
        nodeRelSize={settings.nodeSize}
        nodeVal={nodeValFn}
        nodeThreeObject={nodeThreeObject}
        linkColor={linkColorFn}
        linkWidth={settings.linkThickness}
        linkDirectionalArrowLength={settings.showArrows ? 5 : 0}
        linkDirectionalArrowColor={linkArrowColorFn}
        linkDirectionalParticles={4}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={() => 'rgba(128, 128, 128, 0.4)'}
        enableNodeDrag={true}
        enableNavigationControls={true}
        d3AlphaDecay={settings.d3AlphaDecay}
        d3VelocityDecay={settings.d3VelocityDecay}
        cooldownTicks={300}
        warmupTicks={30}
        d3AlphaMin={0.001}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={handleEngineStop}
      />

      {/* Hover tooltip — Holographic data tag */}
      {hoveredNode && selectedNode !== hoveredNode && (
        <div className="absolute top-14 left-3 bg-[var(--color-bg-primary)]/90 backdrop-blur-md px-2.5 py-1.5 rounded border border-[var(--color-border)] max-w-[200px] z-10">
          <div className="font-mono text-xs text-[var(--color-text-primary)]">{hoveredNode.name}</div>
          <div className="text-[9px] font-mono text-[var(--color-text-tertiary)] tracking-wider">{hoveredNode.group}</div>
        </div>
      )}

      {/* Selected node info — Sci-fi data card */}
      {selectedNode && (
        <div className="absolute top-3 p-3 rounded-lg bg-[var(--color-bg-primary)]/90 backdrop-blur-md border border-[var(--color-border)] max-w-[240px] z-10" style={{ right: showSettings ? '266px' : '10px' }}>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--color-border)]">
            <span className="text-[9px] font-mono tracking-[0.2em] text-[var(--color-text-tertiary)]">SELECTED_NODE</span>
            <button onClick={() => setSelectedNode(null)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
              <CloseIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="font-mono text-sm text-[var(--color-text-primary)] mb-1.5">{selectedNode.name}</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
            <span className="text-[10px] font-mono text-[var(--color-text-secondary)] tracking-wider">{selectedNode.group}</span>
          </div>
          <div className="text-[9px] font-mono text-[var(--color-text-tertiary)] truncate tracking-wider">{selectedNode.path}</div>
        </div>
      )}
    </div>
  )
}
