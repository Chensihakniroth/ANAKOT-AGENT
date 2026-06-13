import { Box, Text } from '@anakot/ink'
import { useEffect, useState, useRef } from 'react'

import { fmtK } from '../lib/text.js'
import type { Theme } from '../theme.js'

// ── Iron Man / J.A.R.V.I.S. color palette ─────────────────────────────
// Deep space black, arc reactor cyan, hot gold, warning amber, offline red

const ARC_CYAN = '#00e5ff'
const ARC_CYAN_DIM = '#009faf'
const ARC_GLOW = '#80f7ff'
const HOT_GOLD = '#ffd740'
const HOT_GOLD_DIM = '#c8a000'
const WARNING_AMBER = '#ff9100'
const OFFLINE_RED = '#ff1744'
const OFFLINE_RED_DIM = '#b71c1c'
const HUD_WHITE = '#e0e0e0'
const HUD_DIM = '#6e6e6e'
const HUD_BG = '#0a0a14'
const REACTOR_RING = '#00b8d4'

// ── Reactor pulse frames ───────────────────────────────────────────────
// Concentric rings that contract/expand like the Iron Man arc reactor

const REACTOR_FRAMES = [
  [
    '        ╭─────────────╮',
    '      ╭─┤  ╭───────╮  ├─╮',
    '    ╭─┤  ╭─┤ ╭───╮  ├─╮  ├─╮',
    '    │  │  │ │ ● │ │  │  │  │',
    '    ╰─┤  ╰─┤ ╰───╯  ├─╯  ├─╯',
    '      ╰─┤  ╰───────╯  ├─╯',
    '        ╰─────────────╯',
  ],
  [
    '        ╭─────────────╮',
    '      ╭─┤  ╭─═════╮  ├─╮',
    '    ╭─┤  ╭─┤ ╭═══╮  ├─╮  ├─╮',
    '    │  │  │ │ ◉ │ │  │  │  │',
    '    ╰─┤  ╰─┤ ╰═══╯  ├─╯  ├─╯',
    '      ╰─┤  ╰─═════╯  ├─╯',
    '        ╰─────────────╯',
  ],
  [
    '        ╭─────────────╮',
    '      ╭─┤ ╭═══════╮  ├─╮',
    '    ╭─┤  ╭─┤ ╭═════╮ ├─╮ ├─╮',
    '    │  │  │ │  ◈  │ │  │  │  │',
    '    ╰─┤  ╰─┤ ╰═════╯ ├─╯  ├─╯',
    '      ╰─┤ ╰═══════╯  ├─╯',
    '        ╰─────────────╯',
  ],
  [
    '        ╭─────────────╮',
    '      ╭─┤╭═════════╮ ├─╮',
    '    ╭─┤  ╭─┤╭═══════╮├─╮ ├─╮',
    '    │  │  │ │  ✦✦  │ │  │  │  │',
    '    ╰─┤  ╰─┤╰═══════╯├─╯  ├─╯',
    '      ╰─┤╰═════════╯ ├─╯',
    '        ╰─────────────╯',
  ],
  [
    '        ╭═════════════╮',
    '      ╭═╡             ╞═╮',
    '    ╭═╡   ╭═════════╮   ╞═╮',
    '    ║   ║  ║  ·  ·  ║  ║   ║',
    '    ╰═╡   ╰═════════╯   ╞═╯',
    '      ╰═╡             ╞═╯',
    '        ╰═════════════╯',
  ],
]

// ── HUD scanline effect ────────────────────────────────────────────────

const SCAN_FRAMES = [
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░▓▓▓',
  '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
]

// ── Shutdown sequence phases ──────────────────────────────────────────

interface SessionStats {
  messages: number
  toolsUsed: number
  contextUsed: number
  contextMax: number
  sessionDuration: string
  cost: number
}

interface JARVISGoodbyeProps {
  stats: SessionStats
  reason: 'SIGINT' | 'SIGTERM' | 'SIGHUP' | 'exit'
  t: Theme
}

const centerText = (text: string, width: number): string => {
  const len = [...text].length // Handle unicode width roughly
  const pad = Math.max(0, width - len)
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + text + ' '.repeat(pad - left)
}

export function JARVISGoodbye({ stats, reason, t }: JARVISGoodbyeProps) {
  const [phase, setPhase] = useState(0)
  const [reactorFrame, setReactorFrame] = useState(0)
  const [scanFrame, setScanFrame] = useState(0)
  const startTime = useRef(Date.now())

  // ── Phase progression ───────────────────────────────────────────────
  // Phase 0: HUD boot — "Initiating shutdown sequence..."
  // Phase 1: System status — session stats
  // Phase 2: Power down — reactor spin-down
  // Phase 3: Goodbye — final J.A.R.V.I.S. sign-off

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 3800),
      setTimeout(() => setPhase(4), 5200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── Reactor animation (slows down over time) ────────────────────────

  useEffect(() => {
    if (phase >= 3) {
      return // Stop animating during final goodbye
    }
    const interval = phase === 0 ? 300 : phase === 1 ? 500 : 800
    const id = setInterval(() => {
      setReactorFrame(f => (f + 1) % REACTOR_FRAMES.length)
    }, interval)
    return () => clearInterval(id)
  }, [phase])

  // ── Scanline animation ──────────────────────────────────────────────

  useEffect(() => {
    if (phase >= 3) {
      return
    }
    const id = setInterval(() => {
      setScanFrame(f => (f + 1) % SCAN_FRAMES.length)
    }, 150)
    return () => clearInterval(id)
  }, [phase])

  // ── Computed values ─────────────────────────────────────────────────

  const cols = 64
  const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
  const contextPct = stats.contextMax > 0
    ? Math.round((stats.contextUsed / stats.contextMax) * 100)
    : 0

  const reasonLabel = {
    SIGINT: 'User interrupt (Ctrl+C)',
    SIGTERM: 'Termination signal',
    SIGHUP: 'Connection lost',
    exit: 'User exit',
  }[reason]

  // ── Arc color shifts during shutdown ────────────────────────────────

  const arcColor = phase >= 3 ? OFFLINE_RED_DIM : phase >= 2 ? WARNING_AMBER : ARC_CYAN
  const arcGlow = phase >= 3 ? OFFLINE_RED : phase >= 2 ? HOT_GOLD : ARC_GLOW

  // ── Render ──────────────────────────────────────────────────────────

  const reactorArt = phase >= 3
    ? REACTOR_FRAMES[4] // Collapsed/dim frame
    : REACTOR_FRAMES[reactorFrame]

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      alignItems="center"
      justifyContent="center"
      width="100%"
    >
      {/* ── Top border: J.A.R.V.I.S. header ──────────────────────── */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {phase === 0 && (
          <>
            <Text color={ARC_CYAN} dimColor>
              {centerText('◈ ──────────── J.A.R.V.I.S. ──────────── ◈', cols)}
            </Text>
            <Text color={HUD_DIM}> </Text>
            <Text color={HUD_WHITE} bold>
              {centerText('INITIATING SHUTDOWN SEQUENCE', cols)}
            </Text>
            <Text color={HUD_DIM}>
              {centerText(`Reason: ${reasonLabel}`, cols)}
            </Text>
            <Text color={HUD_DIM}> </Text>
            <Text color={SCAN_FRAMES[scanFrame]}>
              {'▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'}
            </Text>
          </>
        )}

        {phase >= 1 && phase < 3 && (
          <>
            {/* ── System Status HUD ─────────────────────────────── */}
            <Text color={ARC_CYAN} dimColor>
              {centerText('◈ ──────────── SYSTEM DIAGNOSTICS ──────────── ◈', cols)}
            </Text>
            <Box height={1} />

            {/* Status grid */}
            <Box flexDirection="row" justifyContent="center" width={cols}>
              <Box flexDirection="column" width={20} marginRight={2}>
                <Text color={HUD_DIM}>SESSION MESSAGES</Text>
                <Text bold color={HUD_WHITE}>{String(stats.messages).padStart(6, ' ')}</Text>
              </Box>
              <Box flexDirection="column" width={20} marginRight={2}>
                <Text color={HUD_DIM}>TOOLS EXECUTED</Text>
                <Text bold color={HUD_WHITE}>{String(stats.toolsUsed).padStart(6, ' ')}</Text>
              </Box>
              <Box flexDirection="column" width={20}>
                <Text color={HUD_DIM}>DURATION</Text>
                <Text bold color={HUD_WHITE}>  {stats.sessionDuration}</Text>
              </Box>
            </Box>

            <Box height={1} />

            {/* Context bar */}
            <Box flexDirection="row" alignItems="center" justifyContent="center">
              <Text color={HUD_DIM}>CTX </Text>
              <Text color={contextPct > 90 ? OFFLINE_RED : contextPct > 70 ? WARNING_AMBER : ARC_CYAN}>
                {'█'.repeat(Math.floor(contextPct / 5))}
              </Text>
              <Text color={HUD_DIM}>
                {'░'.repeat(20 - Math.floor(contextPct / 5))}
              </Text>
              <Text color={HUD_WHITE}> {contextPct}%</Text>
            </Box>

            <Box height={1} />

            <Text color={HUD_DIM}>
              {centerText(`Cost: $${stats.cost.toFixed(4)}`, cols)}
            </Text>

            <Box height={1} />
            <Text color={SCAN_FRAMES[scanFrame]}>
              {'▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'}
            </Text>
          </>
        )}

        {phase >= 3 && (
          <>
            {/* ── Arc Reactor Spin-Down ──────────────────────────── */}
            <Box flexDirection="column" alignItems="center" marginBottom={2}>
              {reactorArt.map((line, i) => {
                const isCenter = i === 3
                const color = isCenter
                  ? arcGlow
                  : (phase >= 3 && i >= 4)
                    ? OFFLINE_RED_DIM
                    : (phase >= 3 && i <= 2)
                      ? WARNING_AMBER
                      : REACTOR_RING
                return (
                  <Text key={i} color={color} bold={isCenter && phase < 3}>
                    {line}
                  </Text>
                )
              })}
            </Box>

            {phase >= 3 && (
              <>
                <Text color={OFFLINE_RED}>
                  ─── REACTOR OFFLINE ───
                </Text>
                <Box height={1} />

                {/* ── J.A.R.V.I.S. Sign-Off ────────────────────────── */}
                <Text color={HUD_DIM}>
                  {centerText('────────────────────────────────────────────', cols)}
                </Text>
                <Box height={1} />

                <Text color={HOT_GOLD} bold>
                  {centerText('Goodbye, Sir.', cols)}
                </Text>
                <Box height={1} />

                <Text color={HUD_WHITE}>
                  {centerText('_   _ _____      _____ _____ _____ _____', cols)}
                </Text>
                <Text color={HUD_WHITE}>
                  {centerText('| | | |  ___|    |  _  /  ___/  ___|_   _|', cols)}
                </Text>
                <Text color={HUD_WHITE}>
                  {centerText('| | | | |_ _____| | | \\ `--.| |_    | |  ', cols)}
                </Text>
                <Text color={HUD_WHITE}>
                  {centerText('| |/  |  _|_____| | | |`--. \\  _|   | |  ', cols)}
                </Text>
                <Text color={HUD_WHITE}>
                  {centerText('|___/|_|        \\_/ /\\__/ /\\__/ /  |_|  ', cols)}
                </Text>
                <Text color={HUD_WHITE}>
                  {centerText('                    \\_____/\\____/ (_)    ', cols)}
                </Text>

                <Box height={2} />
                <Text color={HUD_DIM}>
                  {centerText(`${stats.messages} exchanges · ${stats.toolsUsed} operations · ${stats.sessionDuration}`, cols)}
                </Text>
                <Text color={HUD_DIM}>
                  {centerText('All systems terminated.', cols)}
                </Text>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
