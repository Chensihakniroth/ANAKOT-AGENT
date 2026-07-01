/**
 * Obsidian Vault Graph Parser
 *
 * Scans a markdown vault for [[WikiLink]] references and produces
 * a force-directed graph data structure for visualization.
 *
 * Runs in the main process — invoked via IPC from the renderer.
 */

export interface GraphNode {
  id: string          // filename without .md
  name: string        // display name (from frontmatter title or filename)
  path: string        // absolute path
  group: string       // folder/group for coloring
  size: number        // connection count for sizing
}

export interface GraphEdge {
  source: string      // source node id
  target: string      // target node id
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphEdge[]
}

export interface VaultScanResult {
  ok: boolean
  rootPath: string
  graph: GraphData
  error?: string
}

const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
const FRONTMATTER_TITLE_REGEX = /^---\s*\n[\s\S]*?title:\s*["']?([^"'\n]+?)["']?\n[\s\S]*?---/

export function normalizeObsidianLinkTarget(rawTarget: string): string {
  if (!rawTarget) return ''
  let target = rawTarget.trim()
  if (!target) return ''

  target = target.split('#')[0].trim()
  target = target.split('|')[0].trim()
  target = target.replace(/^\.\//, '').replace(/^\//, '')
  target = target.replace(/\\/g, '/')
  target = target.replace(/\.md$/i, '')
  return target
}

export function resolveObsidianLinkTarget(rawTarget: string, knownIds: Iterable<string>): string | null {
  const normalized = normalizeObsidianLinkTarget(rawTarget)
  if (!normalized) return null

  const known = Array.from(knownIds)
  if (known.includes(normalized)) return normalized

  const basename = normalized.split('/').pop() || normalized
  const match = known.find(id => {
    const normalizedId = id.split('/').pop() || id
    return normalizedId === basename || id === basename
  })
  return match ?? null
}

/**
 * Synchronously scan a vault directory for notes and wikilinks.
 * Returns a graph data structure ready for force-directed rendering.
 */
export function scanVault(rootPath: string, fs: any, path: any): VaultScanResult {
  try {
    if (!rootPath || !fs.existsSync(rootPath)) {
      return { ok: false, rootPath: rootPath || '', error: 'vault path not found', graph: { nodes: [], links: [] } }
    }

    const nodes: GraphNode[] = []
    const links: GraphEdge[] = []
    const noteEntries: Array<{ id: string; name: string; path: string; group: string; content: string }> = []
    const linkCounts = new Map<string, number>()

    function scanDir(dir: string, group: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue // skip .obsidian, .git, etc.
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name), entry.name)
          continue
        }
        if (!entry.name.endsWith('.md')) continue

        const filePath = path.join(dir, entry.name)
        const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/')
        const id = relativePath.replace(/\.md$/i, '')
        const content = fs.readFileSync(filePath, 'utf-8')

        // Extract title from YAML frontmatter
        let name = id.split('/').pop() || id
        const fmMatch = content.match(FRONTMATTER_TITLE_REGEX)
        if (fmMatch) name = fmMatch[1].trim()

        noteEntries.push({ id, name, path: filePath, group: group || 'root', content })
      }
    }

    scanDir(rootPath, '')

    const noteIds = noteEntries.map(note => note.id)
    for (const note of noteEntries) {
      const targets = new Set<string>()
      let match: RegExpExecArray | null
      WIKI_LINK_REGEX.lastIndex = 0
      while ((match = WIKI_LINK_REGEX.exec(note.content)) !== null) {
        const target = normalizeObsidianLinkTarget(match[1])
        if (!target) continue
        const resolved = resolveObsidianLinkTarget(target, noteIds)
        if (!resolved || resolved === note.id) continue
        targets.add(resolved)
        linkCounts.set(resolved, (linkCounts.get(resolved) || 0) + 1)
      }

      nodes.push({ id: note.id, name: note.name, path: note.path, group: note.group || 'root', size: 0 })

      for (const target of targets) {
        links.push({ source: note.id, target })
      }
    }

    // Calculate node sizes based on total connections
    for (const node of nodes) {
      const outgoing = links.filter(l => l.source === node.id).length
      const incoming = linkCounts.get(node.id) || 0
      node.size = Math.max(4, Math.min(20, (outgoing + incoming) * 2))
    }

    return { ok: true, rootPath, graph: { nodes, links } }
  } catch (error: any) {
    return { ok: false, rootPath: rootPath || '', error: String(error), graph: { nodes: [], links: [] } }
  }
}
