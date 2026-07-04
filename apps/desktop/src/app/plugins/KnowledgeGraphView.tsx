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
  'Anakot Agent': '#0053fd',
  'nile training': '#10b981',
  'Daily Notes': '#f59e0b',
  root: '#8b5cf6',
}

const FALLBACK_COLORS = [
  '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6', '#eab308', '#a855f7',
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
      <span className={`relative inline-flex h-[18px] w-[32px] shrink-0 rounded-full border-2 transition-colors ${
        value ? 'bg-[#8A2BE2] border-transparent' : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
      }`}>
        <span className={`pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-[14px]' : 'translate-x-0'
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
        background: `linear-gradient(to right, #8A2BE2 0%, #8A2BE2 ${pct}%, #555 ${pct}%, #555 100%)`,
      }}
    />
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className="group" open={open}>
      <summary className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-white list-none cursor-pointer" onClick={e => { e.preventDefault(); setOpen(!open) }}>
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} strokeWidth={2} />
        {title}
      </summary>
      <div className="space-y-2 pb-2">{children}</div>
    </details>
  )
}

export function KnowledgeGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const zoomedRef = useRef(false)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [showSettings, setShowSettings] = useState(false)
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
      if (sphereGeomRef.current) sphereGeomRef.current.dispose()
      materialCacheRef.current.forEach(m => m.dispose())
      materialCacheRef.current.clear()
    }
  }, [])

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }
  }, [])

  const getNodeColor = (node: GraphNode) => {
    return GROUP_COLORS[node.group] || FALLBACK_COLORS[node.id.charCodeAt(0) % FALLBACK_COLORS.length]
  }

  const scanVault = useCallback(async () => {
    if (!vaultPath) { setError('No vault path set'); return }
    setLoading(true); setError(null)
    try {
      const result = await window.anakotDesktop.scanObsidianVault(vaultPath)
      if (result.ok) { setGraphData(result.graph); setError(null); setLastScanTime(new Date()); zoomedRef.current = false }
      else { setError(result.error || 'Unknown error'); setGraphData(null) }
    } catch (e) { setError(String(e)); setGraphData(null) }
    finally { setLoading(false) }
  }, [vaultPath])

  // --- Graph Data Loading ---

  useEffect(() => {
    updateSize()
    const container = containerRef.current
    if (!container) return
    window.addEventListener('resize', updateSize)
    return () => { window.removeEventListener('resize', updateSize) }
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

  // Reheat simulation only when user tweaks settings (safe because
  // initialization is already complete by the time they interact)
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
  }, [settings])

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
  const linkColorFn = useCallback(() => '#666', [])
  const linkArrowColorFn = useCallback(() => '#888', [])

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
  }, [settings.nodeSize, getSphereGeometry, getNodeMaterial])

  // --- Render States ---

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading knowledge graph...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-red-500">
          <p>Error: {error}</p>
          {vaultPath && (
            <div className="mt-4">
              <button onClick={handleRefresh} className="text-xs px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors">Try Again</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <span>No graph data available</span>
          {vaultPath && <button onClick={handleRefresh} className="mt-2 text-xs px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors">Scan Vault</button>}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ width: '100%', height: '100%' }}>
      {/* Top bar */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <button onClick={() => setShowSettings(s => !s)}
          className={`p-1 rounded transition-colors ${showSettings ? 'bg-[var(--color-bg-tertiary)]' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
          title="Settings"
        >
          <IconSettings className="h-4 w-4 text-white" strokeWidth={2} />
        </button>
        <button onClick={handleRefresh} className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-white" title="Rescan vault">
          <RefreshIcon className="h-3 w-3 mr-1" strokeWidth={2} />
          Refresh
        </button>
        <div className="flex items-center gap-2">
          {lastScanTime && <span className="text-[10px] text-[var(--color-text-tertiary)]">{lastScanTime.toLocaleTimeString()}</span>}
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{graphData?.nodes.length ?? 0}n {graphData?.links.length ?? 0}e</span>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-0 right-0 z-20 h-full w-[260px] overflow-y-auto border-l border-[var(--color-border)] bg-[#282828] p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-[var(--color-text-tertiary)] hover:text-white">
              <CloseIcon className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <Section title="Display">
            <div className="flex items-center justify-between">
              <span className="text-white">Labels</span>
              <Toggle value={settings.labelsVisible} onChange={v => setSettings(s => ({ ...s, labelsVisible: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white">Arrows</span>
              <Toggle value={settings.showArrows} onChange={v => setSettings(s => ({ ...s, showArrows: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Node size</span><span className="text-[#aaa] text-[10px]">{settings.nodeSize.toFixed(1)}</span></div>
              <Slider value={settings.nodeSize} min={1} max={20} step={0.5} onChange={v => setSettings(s => ({ ...s, nodeSize: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Link thickness</span><span className="text-[#aaa] text-[10px]">{settings.linkThickness.toFixed(1)}</span></div>
              <Slider value={settings.linkThickness} min={0.5} max={5} step={0.5} onChange={v => setSettings(s => ({ ...s, linkThickness: v }))} />
            </div>
          </Section>

          <Section title="Forces">
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Centre force</span><span className="text-[#aaa] text-[10px]">{settings.centreForce.toFixed(1)}</span></div>
              <Slider value={settings.centreForce} min={0} max={2} step={0.1} onChange={v => setSettings(s => ({ ...s, centreForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Repel force</span><span className="text-[#aaa] text-[10px]">{settings.repelForce}</span></div>
              <Slider value={settings.repelForce} min={-300} max={0} step={5} onChange={v => setSettings(s => ({ ...s, repelForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Link force</span><span className="text-[#aaa] text-[10px]">{settings.linkForce.toFixed(2)}</span></div>
              <Slider value={settings.linkForce} min={0} max={1} step={0.05} onChange={v => setSettings(s => ({ ...s, linkForce: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Link distance</span><span className="text-[#aaa] text-[10px]">{settings.linkDistance}</span></div>
              <Slider value={settings.linkDistance} min={10} max={300} step={5} onChange={v => setSettings(s => ({ ...s, linkDistance: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Alpha decay</span><span className="text-[#aaa] text-[10px]">{settings.d3AlphaDecay.toFixed(2)}</span></div>
              <Slider value={settings.d3AlphaDecay} min={0.001} max={0.1} step={0.005} onChange={v => setSettings(s => ({ ...s, d3AlphaDecay: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Velocity decay</span><span className="text-[#aaa] text-[10px]">{settings.d3VelocityDecay.toFixed(2)}</span></div>
              <Slider value={settings.d3VelocityDecay} min={0.1} max={0.9} step={0.05} onChange={v => setSettings(s => ({ ...s, d3VelocityDecay: v }))} />
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="text-white">Containment</span><span className="text-[#aaa] text-[10px]">{settings.containmentStrength.toFixed(3)}</span></div>
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
        backgroundColor="#0f0f1a"
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
        linkDirectionalParticles={0}
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

      {/* Hover tooltip */}
      {hoveredNode && selectedNode !== hoveredNode && (
        <div className="absolute top-10 left-2 bg-[var(--color-bg-elevated)]/90 p-2 rounded border border-[var(--color-border)] shadow-lg max-w-[200px] z-10 backdrop-blur-sm">
          <div className="font-medium text-xs text-[var(--color-text-primary)]">{hoveredNode.name}</div>
          <div className="text-[10px] text-[var(--color-text-tertiary)]">{hoveredNode.group}</div>
        </div>
      )}

      {/* Selected node info */}
      {selectedNode && (
        <div className="absolute top-2 right-2 bg-[var(--color-bg-elevated)] p-2.5 rounded border border-[var(--color-border)] shadow-lg max-w-[220px] z-10" style={{ right: showSettings ? '264px' : '2px' }}>
          <div className="font-medium text-sm text-[var(--color-text-primary)] mb-0.5">{selectedNode.name}</div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">{selectedNode.group}</div>
          <div className="text-[10px] text-[var(--color-text-tertiary)] truncate">{selectedNode.path}</div>
          <button onClick={() => setSelectedNode(null)} className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors">Close</button>
        </div>
      )}
    </div>
  )
}
