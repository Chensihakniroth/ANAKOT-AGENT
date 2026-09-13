import { atom } from 'nanostores'
// MCP health — ported from Hermes
export const $mcpHealth = atom<Record<string, { status: string }>>({})
export function checkMcpHealth(serverName: string): Promise<{ status: string }> {
  return Promise.resolve({ status: 'unknown' })
}