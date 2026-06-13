import { JARVISGoodbye } from '../components/jarvisGoodbye.js'
import { renderSync } from '@anakot/ink'
import type { Theme } from '../theme.js'

interface GoodbyeOptions {
  reason: 'SIGINT' | 'SIGTERM' | 'SIGHUP' | 'exit'
  theme: Theme
  messages?: number
  toolsUsed?: number
  contextUsed?: number
  contextMax?: number
  sessionDuration?: string
  cost?: number
}

/**
 * Renders the J.A.R.V.I.S. shutdown sequence, then calls process.exit.
 *
 * Uses Ink's renderSync to paint the goodbye screen into the current
 * AlternateScreen buffer, then waits for the animation to finish
 * before exiting.
 */
export function showGoodbyeAndExit(options: GoodbyeOptions) {
  const {
    reason,
    theme,
    messages = 0,
    toolsUsed = 0,
    contextUsed = 0,
    contextMax = 0,
    sessionDuration = '0s',
    cost = 0,
  } = options

  // Map signal to exit code
  const EXIT_CODES: Record<string, number> = {
    SIGINT: 130,
    SIGTERM: 143,
    SIGHUP: 129,
    exit: 0,
  }
  const exitCode = EXIT_CODES[reason] ?? 0

  // Clear the screen before rendering goodbye
  process.stdout.write('\x1b[2J\x1b[H\x1b[3J')

  // Render the goodbye screen synchronously via Ink
  renderSync(
    <JARVISGoodbye
      stats={{
        messages,
        toolsUsed,
        contextUsed,
        contextMax,
        sessionDuration,
        cost,
      }}
      reason={reason}
      t={theme}
    />,
    {
      stdout: process.stdout,
      stderr: process.stderr,
    }
  )

  // After the animation duration (~5.5s), exit
  // The animation phases total: 800 + 1400 + 1600 + 1400 = 5200ms
  // Add 1.5s buffer for the final state to be visible
  const timer = setTimeout(() => {
    process.exit(exitCode)
  }, 7000)

  // Allow the process to be killed even during the goodbye
  timer.unref?.()
}
