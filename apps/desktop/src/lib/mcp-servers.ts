import { atom } from 'nanostores'
// MCP servers — ported from Hermes
export const $mcpServers = atom<Array<{ name: string; status: string }>>([])
export function refreshMcpServers(): Promise<void> {
  return Promise.resolve()
}