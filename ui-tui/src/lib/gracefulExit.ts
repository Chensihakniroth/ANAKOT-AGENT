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

    // For Ctrl+C: Ink's input handler calls die() which sets shuttingDown=true
    // and shows the goodbye screen. The goodbye screen calls process.exit(0).
    // For other signals (SIGHUP, SIGTERM): show goodbye and exit.
    patchUiState({ shuttingDown: true })

    // Run cleanups after goodbye animation completes
    setTimeout(() => {
      void Promise.allSettled(cleanups.map(fn => Promise.resolve().then(fn))).then(() => {
        process.exit(code)
      })
    }, 9000).unref?.()

    // Hard failsafe
    setTimeout(() => {
      process.exit(code)
    }, 12000).unref?.()
  }

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => exit(SIGNAL_EXIT_CODE[sig], sig))
  }

  process.on('uncaughtException', err => onError?.('uncaughtException', err))
  process.on('unhandledRejection', reason => onError?.('unhandledRejection', reason))
}
