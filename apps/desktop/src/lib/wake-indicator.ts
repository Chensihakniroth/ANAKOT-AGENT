// Wake indicator IPC wrapper — always-on-top light showing wake-word state.
// Thin typed facade over `window.anakotDesktop.wakeIndicator`.

export type WakeIndicatorState = 'hidden' | 'listening' | 'detected' | 'processing'

export function getWakeIndicatorState(): Promise<{ ok: boolean; state: string }> {
  return window.anakotDesktop?.wakeIndicator?.getState() ?? Promise.resolve({ ok: false, state: 'hidden' })
}

export function setWakeIndicatorState(state: WakeIndicatorState): Promise<{ ok: boolean }> {
  return window.anakotDesktop?.wakeIndicator?.setState(state) ?? Promise.resolve({ ok: false })
}

export function showWakeIndicator(): Promise<{ ok: boolean; state: string }> {
  return window.anakotDesktop?.wakeIndicator?.show() ?? Promise.resolve({ ok: false, state: 'hidden' })
}

export function hideWakeIndicator(): Promise<{ ok: boolean }> {
  return window.anakotDesktop?.wakeIndicator?.hide() ?? Promise.resolve({ ok: false })
}

export function onWakeIndicatorState(callback: (state: WakeIndicatorState) => void): () => void {
  return window.anakotDesktop?.wakeIndicator?.onState((state) => callback(state as WakeIndicatorState)) ?? (() => {})
}
