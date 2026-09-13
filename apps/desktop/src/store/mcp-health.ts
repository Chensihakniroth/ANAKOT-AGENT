import { atom } from 'nanostores'

import { gatewayRpc } from '@/lib/gateway-rpc'

// MCP health — ported from Hermes with real gateway integration
export interface McpHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastCheck: number
  message?: string
}

export const $mcpHealth = atom<Record<string, McpHealthStatus>>({})

export async function checkMcpHealth(serverName: string): Promise<McpHealthStatus> {
  try {
    const result = await gatewayRpc<{ status?: string; message?: string }>('mcp.health', { server: serverName })
    const status: McpHealthStatus = {
      status: (result.status as McpHealthStatus['status']) || 'unknown',
      lastCheck: Date.now(),
      message: result.message,
    }
    $mcpHealth.set({ ...$mcpHealth.get(), [serverName]: status })
    return status
  } catch (error) {
    const status: McpHealthStatus = {
      status: 'unhealthy',
      lastCheck: Date.now(),
      message: error instanceof Error ? error.message : String(error),
    }
    $mcpHealth.set({ ...$mcpHealth.get(), [serverName]: status })
    return status
  }
}

export function getMcpHealth(serverName: string): McpHealthStatus | undefined {
  return $mcpHealth.get()[serverName]
}

export function getAllMcpHealth(): Record<string, McpHealthStatus> {
  return $mcpHealth.get()
}

// Check all MCP servers
export async function checkAllMcpHealth(): Promise<void> {
  try {
    const result = await gatewayRpc<{ servers?: string[] }>('mcp.list')
    const servers = result.servers || []
    await Promise.all(servers.map(checkMcpHealth))
  } catch {
    // Ignore errors — best effort
  }
}
