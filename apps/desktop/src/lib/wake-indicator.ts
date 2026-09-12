// Wake indicator IPC read-only facade — typed access to the native wake-word
// light. Mutating helpers (show/hide/setState) live in @/store/wake-indicator,
// which update the nanostore AND call IPC. Import from there to change state.

export type WakeIndicatorState = 'hidden' | 'listening' | 'detected' | 'processing'

export function getWakeIndicatorState(): Promise<{ ok: boolean; state: string }> {
  return window.anakotDesktop?.wakeIndicator?.getState() ?? Promise.resolve({ ok: false, state: 'hidden' })
}

export function onWakeIndicatorState(callback: (state: WakeIndicatorState) => void): () => void {
  return window.anakotDesktop?.wakeIndicator?.onState((state) => callback(state as WakeIndicatorState)) ?? (() => {})
}
