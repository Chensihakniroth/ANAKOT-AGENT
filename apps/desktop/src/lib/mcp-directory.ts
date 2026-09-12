// MCP directory — browse and search the MCP server directory.

export interface McpDirectoryEntry {
  name: string
  description: string
  url?: string
  command?: string
  stars?: number
}

export interface McpSearchResult {
  entries: McpDirectoryEntry[]
  total: number
}

// Curated list of known MCP servers (offline-capable)
const KNOWN_SERVERS: McpDirectoryEntry[] = [
  { name: 'filesystem', description: 'Local filesystem access', command: 'npx -y @modelcontextprotocol/server-filesystem' },
  { name: 'git', description: 'Git repository operations', command: 'npx -y @modelcontextprotocol/server-git' },
  { name: 'github', description: 'GitHub API access', command: 'npx -y @modelcontextprotocol/server-github' },
  { name: 'postgres', description: 'PostgreSQL database', command: 'npx -y @modelcontextprotocol/server-postgres' },
  { name: 'memory', description: 'In-memory key-value store', command: 'npx -y @modelcontextprotocol/server-memory' },
  { name: 'puppeteer', description: 'Browser automation', command: 'npx -y @anthropic-ai/mcp-puppeteer' },
  { name: 'brave-search', description: 'Brave Search API', command: 'npx -y @anthropic-ai/mcp-brave-search' },
]

export function searchMcpDirectory(query: string): McpSearchResult {
  const q = query.toLowerCase().trim()
  if (!q) return { entries: KNOWN_SERVERS, total: KNOWN_SERVERS.length }

  const entries = KNOWN_SERVERS.filter(
    s =>
      s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  )
  return { entries, total: entries.length }
}

export function getMcpDirectory(): McpSearchResult {
  return { entries: KNOWN_SERVERS, total: KNOWN_SERVERS.length }
}
