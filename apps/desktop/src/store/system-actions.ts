import { atom } from 'nanostores'

import { translateNow } from '@/i18n'
import { gatewayRpc } from '@/lib/gateway-rpc'
import { notifyError } from '@/store/notifications'

// System actions — ported from Hermes with real gateway integration
export const $gatewayRestarting = atom(false)
export const $gatewayReconnectAttempts = atom(0)

// True while a gateway restart is in flight — drives the statusbar gateway
// indicator (glyph spinner) so the restart shows up where users already look,
// instead of a toast that vanishes or a generic "Agents running" counter.
export async function runGatewayRestart(): Promise<void> {
  $gatewayRestarting.set(true)
  $gatewayReconnectAttempts.set($gatewayReconnectAttempts.get() + 1)

  try {
    await gatewayRpc('gateway.restart', {})
  } catch (err) {
    notifyError(err, translateNow('commandCenter.gatewayRestartFailed'))
  } finally {
    $gatewayRestarting.set(false)
  }
}

export async function getActionStatus(actionId: string): Promise<{ status: string }> {
  try {
    const result = await gatewayRpc<{ status?: string }>('action.status', { action_id: actionId })
    return { status: result.status || 'unknown' }
  } catch {
    return { status: 'unknown' }
  }
}

export function resetGatewayReconnectAttempts() {
  $gatewayReconnectAttempts.set(0)
}
