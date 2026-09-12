// MCP install deeplink flow — holds a pending MCP install request
// triggered by a `anakot://mcp/install?...` deeplink URI.

import { atom } from 'nanostores'

export interface McpInstallRequest {
  sourceUrl: string
  serverName?: string
  receivedAt: number
}

export const $pendingMcpInstall = atom<McpInstallRequest | null>(null)

export function requestMcpInstall(sourceUrl: string, serverName?: string): void {
  $pendingMcpInstall.set({ sourceUrl, serverName, receivedAt: Date.now() })
}

export function clearPendingMcpInstall(): void {
  $pendingMcpInstall.set(null)
}
