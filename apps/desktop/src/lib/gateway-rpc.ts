import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'

import { $gateway } from '@/store/gateway'

// Gateway RPC client — connects to the Anakot backend via WebSocket
export interface GatewayRpcOptions { timeout?: number }

export function useGatewayRpc() {
  return useStore($gateway)
}

export async function gatewayRpc<T>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  const gateway = $gateway.get()
  if (!gateway) {
    throw new Error('Gateway not connected')
  }
  return gateway.request<T>(method, params, timeoutMs)
}

// Connection-scoped gateway RPC (uses profile-scoped connection)
export async function requestForSessionProfile(profile: string) {
  return async <R>(method: string, params?: Record<string, unknown>): Promise<R> => {
    const gateway = $gateway.get()
    if (!gateway) {
      throw new Error('Gateway not connected')
    }
    return gateway.request<R>(method, { ...params, profile })
  }
}
