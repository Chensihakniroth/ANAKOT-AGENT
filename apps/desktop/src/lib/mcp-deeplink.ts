// MCP deeplink — parse `anakot://mcp/install?...` deeplink URIs.

export interface McpDeeplink {
  action: 'install' | 'configure' | 'unknown'
  sourceUrl?: string
  serverName?: string
  raw: string
}

const MCP_INSTALL_PATTERN = /^anakot:\/\/mcp\/install\?/

export function parseMcpDeeplink(uri: string): McpDeeplink {
  try {
    if (!MCP_INSTALL_PATTERN.test(uri)) {
      return { action: 'unknown', raw: uri }
    }

    const queryStart = uri.indexOf('?')
    const params = new URLSearchParams(uri.slice(queryStart + 1))

    return {
      action: 'install',
      sourceUrl: params.get('url') ?? undefined,
      serverName: params.get('name') ?? undefined,
      raw: uri,
    }
  } catch {
    return { action: 'unknown', raw: uri }
  }
}

export function isMcpDeeplink(uri: string): boolean {
  return MCP_INSTALL_PATTERN.test(uri)
}
