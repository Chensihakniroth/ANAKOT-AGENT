import { atom } from 'nanostores'
// Gateway reconnect — full port from Hermes
export const $gatewayReconnecting = atom(false)
export const $gatewayReconnectAttempts = atom(0)
let reconnectHandlers: Array<() => Promise<void> | void> = []
export function registerGatewayReconnect(handler: () => Promise<void> | void): () => void {
  reconnectHandlers.push(handler)
  return () => { reconnectHandlers = reconnectHandlers.filter(h => h !== handler) }
}
export async function reconnectGateway(): Promise<void> {
  $gatewayReconnecting.set(true)
  $gatewayReconnectAttempts.set($gatewayReconnectAttempts.get() + 1)
  try {
    for (const handler of reconnectHandlers) {
      await handler()
    }
  } finally {
    $gatewayReconnecting.set(false)
  }
}
export function resetGatewayReconnectAttempts() {
  $gatewayReconnectAttempts.set(0)
}