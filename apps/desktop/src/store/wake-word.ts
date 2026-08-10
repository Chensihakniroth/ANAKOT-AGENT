import type { GatewayEvent } from '@anakot/shared'
import { atom } from 'nanostores'

import { activeGateway } from '@/store/gateway'

/**
 * Wake-word ("hey casca") client state.
 *
 * The backend owns the microphone and the detector (single-owner lease); this
 * store is a thin RPC facade for arming/disarming plus a mirror of the
 * server's status. The `wake.detected` push event lands in `$wakeFired`, which
 * the composer subscribes to in order to open a voice turn.
 */

export interface WakeWordRequirements {
  available: boolean
  provider: string
  deps_available: boolean
  audio_available: boolean
  local_input_available: boolean
  capture: string
  stt_available: boolean
  tts_available: boolean
  phrase: string
  hint: string
}

export interface WakeWordStatus {
  enabled: boolean
  listening: boolean
  started: boolean
  silent: boolean
  capture: string
  requirements: WakeWordRequirements | null
  device: Record<string, unknown> | null
  frame: { sample_rate: number; frame_length: number; external_audio: boolean } | null
  phrase: string
}

export interface WakeWordState {
  status: WakeWordStatus | null
  refreshing: boolean
  busy: boolean
  error: string | null
}

export const $wakeWord = atom<WakeWordState>({
  status: null,
  refreshing: false,
  busy: false,
  error: null
})

/** Last `wake.detected` push — composer subscribes here to start a voice turn. */
export const $wakeFired = atom<{ phrase: string; at: number } | null>(null)

let wakeEventUnsub: (() => void) | null = null

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/** Subscribe to server-pushed wake events. Idempotent; safe to call repeatedly. */
export function initWakeWord(): void {
  if (wakeEventUnsub) {
    return
  }
  const gateway = activeGateway()
  if (!gateway) {
    return
  }
  wakeEventUnsub = gateway.onEvent((event: GatewayEvent) => {
    if (event.type !== 'wake.detected') {
      return
    }
    const payload = (event.payload ?? {}) as { phrase?: unknown }
    const phrase = typeof payload.phrase === 'string' ? payload.phrase : ''
    $wakeFired.set({ phrase, at: Date.now() })
  })
}

export async function refreshWakeStatus(): Promise<WakeWordStatus | null> {
  const gateway = activeGateway()
  if (!gateway) {
    return null
  }
  const previous = $wakeWord.get()
  $wakeWord.set({ ...previous, refreshing: true })
  try {
    const status = await gateway.request<WakeWordStatus>('wake.status', {}, 10_000)
    $wakeWord.set({ ...$wakeWord.get(), status, refreshing: false, error: null })
    return status
  } catch (error) {
    $wakeWord.set({ ...$wakeWord.get(), refreshing: false, error: errorMessage(error) })
    return null
  }
}

/**
 * Arm the listener. Persists the master switch (`wake_word.enabled: true`) so
 * the app re-arms on next launch, then calls `wake.start`.
 */
export async function armWake(): Promise<boolean> {
  const gateway = activeGateway()
  if (!gateway) {
    return false
  }
  initWakeWord()
  $wakeWord.set({ ...$wakeWord.get(), busy: true, error: null })
  try {
    try {
      await gateway.request('config.set', { key: 'wake_word.enabled', value: true }, 10_000)
    } catch {
      // Non-fatal: arming still proceeds; status reflects reality.
    }
    await gateway.request('wake.start', {}, 15_000)
    await refreshWakeStatus()
    $wakeWord.set({ ...$wakeWord.get(), busy: false })
    return true
  } catch (error) {
    $wakeWord.set({ ...$wakeWord.get(), busy: false, error: errorMessage(error) })
    return false
  }
}

/**
 * Disarm the listener and clear the master switch. `wake.stop` releases the
 * mic; the backend also disarms when it sees `enabled` flip to false (privacy
 * invariant), so stopping first is belt-and-braces.
 */
export async function disarmWake(): Promise<boolean> {
  const gateway = activeGateway()
  if (!gateway) {
    return false
  }
  $wakeWord.set({ ...$wakeWord.get(), busy: true })
  try {
    try {
      await gateway.request('wake.stop', {}, 10_000)
    } catch {
      // Ignore — the config flip below also disarms server-side.
    }
    try {
      await gateway.request('config.set', { key: 'wake_word.enabled', value: false }, 10_000)
    } catch {
      // Non-fatal: listener is already stopped.
    }
    await refreshWakeStatus()
    $wakeWord.set({ ...$wakeWord.get(), busy: false })
    return true
  } catch (error) {
    $wakeWord.set({ ...$wakeWord.get(), busy: false, error: errorMessage(error) })
    return false
  }
}

/** Release the backend mic while a voice turn owns the machine's audio. */
export async function pauseWake(): Promise<void> {
  const gateway = activeGateway()
  if (!gateway) {
    return
  }
  try {
    await gateway.request('wake.pause', {}, 10_000)
  } catch {
    // Swallow — pausing a non-armed listener is a no-op server-side.
  }
}

/** Re-arm after a voice turn. No-op when the listener isn't paused. */
export async function resumeWake(): Promise<void> {
  const gateway = activeGateway()
  if (!gateway) {
    return
  }
  try {
    await gateway.request('wake.resume', {}, 10_000)
  } catch {
    // Swallow — same as pause.
  }
}
