import { atom } from 'nanostores'
// MCP health — full port from Hermes
export interface McpHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastCheck: number
  message?: string
}
export const $mcpHealth = atom<Record<string, McpHealthStatus>>({})
export async function checkMcpHealth(serverName: string): Promise<McpHealthStatus> {
  const status: McpHealthStatus = { status: 'unknown', lastCheck: Date.now() }
  $mcpHealth.set({ ...$mcpHealth.get(), [serverName]: status })
  return status
}
export function getMcpHealth(serverName: string): McpHealthStatus | undefined {
  return $mcpHealth.get()[serverName]
}
export function getAllMcpHealth(): Record<string, McpHealthStatus> {
  return $mcpHealth.get()
}