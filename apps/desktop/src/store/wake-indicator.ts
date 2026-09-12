import { atom } from 'nanostores'

import type { WakeIndicatorState } from '@/lib/wake-indicator'

export { type WakeIndicatorState }

export const $wakeIndicatorState = atom<WakeIndicatorState>('hidden')
export const $wakeIndicatorVisible = atom(false)

export function showWakeIndicator(): void {
  $wakeIndicatorVisible.set(true)
  window.anakotDesktop?.wakeIndicator?.show()
}

export function hideWakeIndicator(): void {
  $wakeIndicatorVisible.set(false)
  $wakeIndicatorState.set('hidden')
  window.anakotDesktop?.wakeIndicator?.hide()
}

export function setWakeIndicatorState(state: WakeIndicatorState): void {
  $wakeIndicatorState.set(state)
  window.anakotDesktop?.wakeIndicator?.setState(state)
}

export async function initWakeIndicator(): Promise<void> {
  const result = await window.anakotDesktop?.wakeIndicator?.getState()
  if (result?.state) {
    $wakeIndicatorState.set(result.state as WakeIndicatorState)
  }
}
