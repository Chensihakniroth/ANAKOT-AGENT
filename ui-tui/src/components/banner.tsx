import { Box, Text } from '@anakot/ink'

import type { Theme } from '../theme.js'

// ── ASCII Art Banner ───────────────────────────────────────────────────

const BANNER_ART = [
  '  █████╗ ███╗   ██╗ █████╗ ██╗  ██╗',
  ' ██╔══██╗████╗  ██║██╔══██╗██║ ██╔╝',
  ' ███████║██╔██╗ ██║███████║█████╔╝',
  ' ██╔══██║██║╚██╗██║██╔══██║██╔═██╗',
  ' ██║  ██║██║ ╚████║██║  ██║██║  ██╗',
  ' ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝',
]

interface BannerProps {
  version?: string
  model?: string
  maxWidth?: number
  t: Theme
}

/**
 * Anakot startup banner — ASCII art logo with version and model info.
 *
 * Displayed on TUI startup, then collapses to the compact status bar
 * after first keypress or 2-second timeout.
 *
 * Design: Clean box with gold border, ASCII "ANAKOT" art, Khmer subtitle.
 */
export function StartupBanner({ version, model, maxWidth = 40, t }: BannerProps) {
  const w = Math.min(maxWidth, 42)
  const horizontal = '─'.repeat(w - 2)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column" borderStyle="single" borderColor={t.color.accent} paddingX={1}>
        {/* Top border */}
        <Text color={t.color.accent}>╭{horizontal}╮</Text>

        {/* ASCII art lines */}
        {BANNER_ART.map((line, i) => (
          <Text color={t.color.accent} key={i}>
            │{line.padEnd(w - 2, ' ')}│
          </Text>
        ))}

        {/* Spacer */}
        <Text color={t.color.accent}>│{''.padEnd(w - 2, ' ')}│</Text>

        {/* Subtitle: Khmer + callmemo */}
        <Text color={t.color.textMuted}>
          │{'  អនាគត  ·  callmemo'.padEnd(w - 2, ' ')}│
        </Text>

        {/* Version + model */}
        <Text color={t.color.textDim}>
          │{`  v${version ?? '0.0.0'}  ·  ${model ?? 'connecting...'}`.padEnd(w - 2, ' ')}│
        </Text>

        {/* Spacer */}
        <Text color={t.color.accent}>│{''.padEnd(w - 2, ' ')}│</Text>

        {/* Bottom border */}
        <Text color={t.color.accent}>╰{horizontal}╯</Text>
      </Box>
    </Box>
  )
}

/**
 * Compact banner fallback for narrow terminals (< 40 cols).
 * Shows just the diamond + name + version.
 */
export function CompactBanner({ version, t }: { version?: string; t: Theme }) {
  return (
    <Box paddingX={1}>
      <Text color={t.color.accent}>◆ </Text>
      <Text color={t.color.text}>Anakot</Text>
      <Text color={t.color.textDim}> v{version ?? '0.0.0'}</Text>
    </Box>
  )
}
