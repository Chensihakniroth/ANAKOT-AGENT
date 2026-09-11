import { atom } from 'nanostores'

export type TerminalBackendStatus = 'ready' | 'needs_setup' | 'unavailable'

export interface TerminalBackend {
  name: string
  label: string
  description: string
  status: TerminalBackendStatus
  active: boolean
  detail: string
}

export const $terminalBackends = atom<TerminalBackend[]>([])
export const $terminalBackendsActive = atom<string>('local')
export const $terminalBackendsLoading = atom(true)

export async function loadTerminalBackends(): Promise<void> {
  $terminalBackendsLoading.set(true)
  try {
    const result = await window.anakotDesktop?.terminalBackends?.get()
    if (result?.ok) {
      $terminalBackends.set(result.backends)
      $terminalBackendsActive.set(result.active)
    }
  } catch {
    // ignore
  } finally {
    $terminalBackendsLoading.set(false)
  }
}

export async function selectTerminalBackend(name: string): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.terminalBackends?.set(name)
    if (result?.ok) {
      $terminalBackendsActive.set(result.active)
      return true
    }
    return false
  } catch {
    return false
  }
}
