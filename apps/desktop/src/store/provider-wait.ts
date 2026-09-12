// Provider wait/loading states — tracks which providers are still initializing.
// Used to show spinners in the model picker.

import { atom } from 'nanostores'

export type ProviderWaitState = 'idle' | 'loading' | 'ready' | 'error'

export const $providerWaitStates = atom<Record<string, ProviderWaitState>>({})

export function setProviderWaitState(provider: string, state: ProviderWaitState): void {
  $providerWaitStates.set({ ...$providerWaitStates.get(), [provider]: state })
}

export function getProviderWaitState(provider: string): ProviderWaitState {
  return $providerWaitStates.get()[provider] ?? 'idle'
}

export function clearProviderWaitState(provider: string): void {
  const next = { ...$providerWaitStates.get() }
  delete next[provider]
  $providerWaitStates.set(next)
}
