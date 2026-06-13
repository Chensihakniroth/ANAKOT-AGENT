import { Box, Text } from '@anakot/ink'
import { useEffect, useState } from 'react'

import type { Theme } from '../theme.js'

// ── Iron Man / J.A.R.V.I.S. palette ─────────────────────────────────────

const CYAN = '#00e5ff'
const GOLD = '#ffd740'
const RED = '#ff1744'
const WHITE = '#e0e0e0'
const DIM = '#555555'

// ── Simple arc reactor: just a pulsing circle ────────────────────────────

const REACTOR_FRAMES = ['○', '◉', '●', '◉']

interface JARVISGoodbyeProps {
  messages: number
  toolsUsed: number
  contextUsed: number
  contextMax: number
  duration: string
  cost: number
  reason: string
  t: Theme
}

export function JARVISGoodbye({ messages, toolsUsed, contextUsed, contextMax, duration, cost, reason, t }: JARVISGoodbyeProps) {
  const [tick, setTick] = useState(0)

  // Slow pulse that decelerates, then exit
  useEffect(() => {
    const speeds = [400, 500, 600, 800, 1000, 1200, 1500, 2000]
    if (tick >= speeds.length) {
      // Animation done — reset terminal and exit cleanly
      process.stdout.write('\x1b[?25h')   // Show cursor
      process.stdout.write('\x1b[2J')     // Clear AlternateScreen
      process.stdout.write('\x1b[H')      // Cursor to top-left
      process.stdout.write('\x1b[?1049l')  // Exit AlternateScreen buffer
      // Clear the main terminal buffer and scrollback too
      process.stdout.write('\x1b[2J')     // Clear visible area
      process.stdout.write('\x1b[H')      // Cursor to top-left
      process.stdout.write('\x1b[3J')     // Clear scrollback buffer
      process.exit(0)
      return
    }
    const id = setTimeout(() => setTick(n => n + 1), speeds[tick])
    return () => clearTimeout(id)
  }, [tick])

  const reactor = REACTOR_FRAMES[Math.min(tick, REACTOR_FRAMES.length - 1)]
  const reactorColor = tick >= 6 ? RED : tick >= 3 ? GOLD : CYAN
  const ctxPct = contextMax > 0 ? Math.round((contextUsed / contextMax) * 100) : 0

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      alignItems="center"
      justifyContent="center"
      width="100%"
    >
      <Box
        borderStyle="round"
        borderColor={DIM}
        flexDirection="column"
        alignItems="center"
        paddingX={2}
        paddingY={1}
      >
        {/* Reactor */}
        <Text color={reactorColor} bold>
          {reactor}
        </Text>

        {/* J.A.R.V.I.S. */}
        <Text color={CYAN} bold>
          J.A.R.V.I.S.
        </Text>

        {/* Status */}
        <Text color={WHITE}>
          Shutting down…
        </Text>

        {/* Reason */}
        <Text color={DIM}>
          {reason}
        </Text>

        {/* Thin divider */}
        <Text color={DIM} wrap="truncate">
          {'─'.repeat(36)}
        </Text>

        {/* Session info — compact 2-column layout */}
        <Box flexDirection="row" justifyContent="space-between" width={36}>
          <Text color={DIM}>messages </Text>
          <Text color={WHITE}>{messages}</Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" width={36}>
          <Text color={DIM}>tools    </Text>
          <Text color={WHITE}>{toolsUsed}</Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" width={36}>
          <Text color={DIM}>context  </Text>
          <Text color={ctxPct > 90 ? RED : ctxPct > 70 ? GOLD : CYAN}>{ctxPct}%</Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" width={36}>
          <Text color={DIM}>duration </Text>
          <Text color={WHITE}>{duration}</Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" width={36}>
          <Text color={DIM}>cost     </Text>
          <Text color={WHITE}>${cost.toFixed(4)}</Text>
        </Box>

        {/* Thin divider */}
        <Text color={DIM} wrap="truncate">
          {'─'.repeat(36)}
        </Text>

        {/* Sign-off */}
        <Text color={GOLD} bold>
          Goodbye, Sir.
        </Text>
      </Box>
    </Box>
  )
}
