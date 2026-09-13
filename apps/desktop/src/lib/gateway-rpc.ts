import { atom } from 'nanostores'
// Gateway RPC client — ported from Hermes
export interface GatewayRpcOptions { timeout?: number }
export async function gatewayRpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  return {} as T
}