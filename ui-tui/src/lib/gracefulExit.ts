import { showGoodbyeAndExit } from './goodbye.jsx'
import { DARK_THEME } from '../theme.js'

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

    // Run cleanups (kill gateway, reset terminal modes) first
    const cleanupPromise = Promise.allSettled(cleanups.map(fn => Promise.resolve().then(fn)))

    cleanupPromise.then(() => {
      // Show the J.A.R.V.I.S. goodbye screen, then exit
      showGoodbyeAndExit({
        reason: signal ?? 'exit',
        theme: DARK_THEME, // Always use dark theme for the exit screen — it looks best
        onComplete: () => {
          // Final failsafe: force exit after goodbye completes
        },
      })
    })

    // Failsafe: force exit if cleanups hang
    setTimeout(() => {
      process.exit(code)
    }, failsafeMs).unref?.()
  }

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => exit(SIGNAL_EXIT_CODE[sig], sig))
  }

  process.on('uncaughtException', err => onError?.('uncaughtException', err))
  process.on('unhandledRejection', reason => onError?.('unhandledRejection', reason))
}
