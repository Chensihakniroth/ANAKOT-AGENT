import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

interface GraphNode {
  id: string
  name: string
  path: string
  group: string
  size: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

interface GraphLink {
  source: string
  target: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
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

function getGroupColor(group: string, index: number): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group]
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

export function KnowledgeGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultPath, setVaultPath] = useState('')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  useEffect(() => {
    async function loadGraph() {
      try {
        setLoading(true)
        setError(null)

        // Get vault path from config (which reads from config.yaml obsidian.vault_path)
        let vaultPath = ''
        try {
          const cfg = await window.anakotDesktop?.api?.({
            path: 'api/config'
          }) as any
          vaultPath = cfg?.obsidian?.vault_path || ''
        } catch {
          // Fallback to env var
          const envResult = await window.anakotDesktop?.getObsidianVaultPath?.()
          if (envResult?.ok && envResult.path) vaultPath = envResult.path
        }

        if (!vaultPath) {
          setError('Obsidian vault path not configured. Set it in Settings → Knowledge Graph.')
          setLoading(false)
          return
        }
        setVaultPath(vaultPath)

        const scanResult = await window.anakotDesktop?.scanObsidianVault?.(vaultPath)
        if (!scanResult?.ok) {
          setError(scanResult?.error || 'Failed to scan vault')
          setLoading(false)
          return
        }

        if (scanResult.graph.nodes.length === 0) {
          setError('No markdown notes found in vault.')
          setLoading(false)
          return
        }

        setGraphData(scanResult.graph as any)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadGraph()
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 500)
      fgRef.current.zoom(2, 500)
    }
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Scanning vault…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3 opacity-50">📊</div>
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Set OBSIDIAN_VAULT_PATH in your environment or .env file.
          </p>
        </div>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-tertiary)]">No notes found in vault.</p>
      </div>
    )
  }

  const groups = [...new Set(graphData.nodes.map(n => n.group))]

  return (
    <div className="relative h-full w-full bg-[var(--color-bg-primary)]" ref={containerRef}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData as any}
        nodeLabel={(node: any) => `${node.name}\n${node.group}\n${node.path}`}
        nodeColor={(node: any) => getGroupColor(node.group, groups.indexOf(node.group))}
        nodeRelSize={5}
        nodeVal={(node: any) => node.size}
        linkColor={() => 'rgba(120, 120, 120, 0.25)'}
        linkWidth={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        cooldownTicks={120}
        enableZoomInteraction
        enablePanInteraction
        enableNodeDrag
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-[var(--color-bg-elevated)]/90 px-3 py-2 text-xs text-[var(--color-text-tertiary)] backdrop-blur-sm border border-[var(--color-border)]">
        <div className="font-medium text-[var(--color-text-primary)]">
          {graphData.nodes.length} notes
        </div>
        <div>{graphData.links.length} links</div>
        {vaultPath && (
          <div className="mt-1 text-[10px] opacity-60 truncate max-w-[200px]" title={vaultPath}>
            {vaultPath}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 rounded-lg bg-[var(--color-bg-elevated)]/90 px-3 py-2 backdrop-blur-sm border border-[var(--color-border)]">
        <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">
          Folders
        </div>
        {groups.map((group, i) => (
          <div key={group} className="flex items-center gap-2 text-xs py-0.5">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: getGroupColor(group, i) }}
            />
            <span className="text-[var(--color-text-primary)]">{group}</span>
            <span className="text-[var(--color-text-tertiary)] ml-auto">
              {graphData.nodes.filter(n => n.group === group).length}
            </span>
          </div>
        ))}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 rounded-lg bg-[var(--color-bg-elevated)]/95 px-4 py-3 backdrop-blur-sm border border-[var(--color-border)] max-w-[280px]">
          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate" title={selectedNode.name}>
            {selectedNode.name}
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            {selectedNode.group} · {graphData.links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length} connections
          </div>
          <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1 opacity-60 truncate" title={selectedNode.path}>
            {selectedNode.path}
          </div>
        </div>
      )}
    </div>
  )
}
