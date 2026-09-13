import { atom } from 'nanostores'

import { gatewayRpc } from '@/lib/gateway-rpc'

// Gateway reconnect — ported from Hermes with real gateway integration
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
    // Notify all registered handlers
    for (const handler of reconnectHandlers) {
      await handler()
    }

    // Also notify gateway
    await gatewayRpc('gateway.reconnect', {})
  } finally {
    $gatewayReconnecting.set(false)
  }
}

export function resetGatewayReconnectAttempts() {
  $gatewayReconnectAttempts.set(0)
}

// Auto-reconnect with backoff
let autoReconnectTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleAutoReconnect(delayMs: number = 1000): void {
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer)
  }
  autoReconnectTimer = setTimeout(async () => {
    if ($gatewayReconnecting.get()) return
    await reconnectGateway()
  }, delayMs)
}

export function cancelAutoReconnect(): void {
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer)
    autoReconnectTimer = null
  }
}
