// Session RPC dispatcher — handles RPC calls from contrib surfaces to sessions.

import { notifyError } from '@/store/notifications'

type RpcHandler = (method: string, params?: Record<string, unknown>) => Promise<unknown>

const handlers = new Map<string, RpcHandler>()

export function registerRpcHandler(method: string, handler: RpcHandler): () => void {
  handlers.set(method, handler)
  return () => { handlers.delete(method) }
}

export async function dispatchSessionRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const handler = handlers.get(method)
  if (!handler) {
    notifyError(`No RPC handler registered for: ${method}`, 'RPC Error')
    throw new Error(`Unknown RPC method: ${method}`)
  }
  return handler(method, params)
}
