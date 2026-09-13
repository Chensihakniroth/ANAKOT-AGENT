import { atom } from 'nanostores'
// MCP probe cache — ported from Hermes
export const $mcpProbeCache = atom<Record<string, { status: string; timestamp: number }>>({})