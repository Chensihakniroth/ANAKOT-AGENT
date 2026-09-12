// MCP import — import an MCP server configuration from JSON or URL.

export interface McpServerConfig {
  name: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string // For SSE/HTTP transport
  type?: 'stdio' | 'sse' | 'http'
}

export interface McpImportResult {
  ok: boolean
  config?: McpServerConfig
  error?: string
}

/** Parse MCP server config from a JSON string. */
export function parseMcpConfigJson(json: string): McpImportResult {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Invalid JSON structure' }
    }

    const config: McpServerConfig = {
      name: parsed.name ?? parsed.serverName ?? 'unnamed',
      command: parsed.command,
      args: Array.isArray(parsed.args) ? parsed.args : undefined,
      env: parsed.env && typeof parsed.env === 'object' ? parsed.env : undefined,
      url: parsed.url,
      type: parsed.type ?? (parsed.url ? 'sse' : 'stdio'),
    }

    if (!config.command && !config.url) {
      return { ok: false, error: 'MCP config must have either "command" or "url"' }
    }

    return { ok: true, config }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Parse failed' }
  }
}

/** Fetch and parse MCP config from a URL. */
export async function importMcpFromUrl(url: string): Promise<McpImportResult> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const text = await res.text()
    return parseMcpConfigJson(text)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Fetch failed' }
  }
}
