import { patchUiState } from '../app/uiStore.js'

interface SetupOptions {
  cleanups?: (() => Promise<void> | void)[]
  failsafeMs?: number
  onError?: (scope: 'uncaughtException' | 'unhandledRejection', err: unknown) => void
  onSignal?: (signal: NodeJS.Signals) => void
}

const SIGNAL_EXIT_CODE: Record<'SIGHUP' | 'SIGINT' | 'SIGTERM', number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
}

const SIGNAL_LABEL: Record<string, 'SIGINT' | 'SIGTERM' | 'SIGHUP'> = {
  SIGINT: 'SIGINT',
  SIGTERM: 'SIGTERM',
  SIGHUP: 'SIGHUP',
}

let wired = false

export function setupGracefulExit({ cleanups = [], failsafeMs = 4000, onError, onSignal }: SetupOptions = {}) {
  if (wired) {
    return
  }

  wired = true

  let shuttingDown = false

  const exit = (code: number, signal?: NodeJS.Signals) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true

    if (signal) {
      onSignal?.(signal)
    }

    // Tell the App component to render the goodbye screen
    patchUiState({ shuttingDown: true })

    // Run cleanups (kill gateway, reset terminal modes) in parallel
    void Promise.allSettled(cleanups.map(fn => Promise.resolve().then(fn))).then(() => {
      // After cleanups + goodbye animation (~7s), exit
      // The goodbye screen auto-exits via its own timer, but this is the failsafe
    })

    // Failsafe: force exit if everything hangs
    setTimeout(() => {
      process.exit(code)
    }, Math.max(failsafeMs, 10000)).unref?.() // At least 10s for the goodbye animation
  }

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => exit(SIGNAL_EXIT_CODE[sig], sig))
  }

  process.on('uncaughtException', err => onError?.('uncaughtException', err))
  process.on('unhandledRejection', reason => onError?.('unhandledRejection', reason))
}
