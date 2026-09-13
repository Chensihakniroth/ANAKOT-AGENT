import { atom } from 'nanostores'
// MCP dashboard OAuth — ported from Hermes
export const $mcpDashboardOAuth = atom<{ connected: boolean }>({ connected: false })