import { atom } from 'nanostores'
// Gateway reconnect — ported from Hermes
export const $gatewayReconnecting = atom(false)
export function registerGatewayReconnect(handler: () => Promise<void> | void): () => void {
  return () => {}
}
export async function reconnectGateway(): Promise<void> {
  $gatewayReconnecting.set(true)
  try { /* reconnect logic */ } finally { $gatewayReconnecting.set(false) }
}