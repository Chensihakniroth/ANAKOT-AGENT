import { Box, Text } from '@anakot/ink'

import { stringWidth } from '@anakot/ink'

import type { Theme } from '../theme.js'

// ── ASCII Art Banner ───────────────────────────────────────────────────
// Uses plain ASCII characters for maximum terminal compatibility.

const BANNER_ART = [
  '   ###  ## ##   ##  ##  ##  ##  #  #  ',
  '  #     # # #  #  # #  # #  # ## #   ',
  '  ####  # # #  #### #### #### # ##    ',
  '     #  # # #  #  # # ##  # ## #  #   ',
  '  ###   #  ##  #  # #  # #  # #   #  ',
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
  const artWidth = BANNER_ART[0]!.length
  const w = Math.min(maxWidth, artWidth + 4)
  const pad = Math.max(0, w - artWidth - 4)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column" borderStyle="single" borderColor={t.color.accent} paddingX={1}>
        {/* Top border */}
        <Text color={t.color.accent}>+{'-'.repeat(w - 2)}+</Text>

        {/* ASCII art lines */}
        {BANNER_ART.map((line, i) => (
          <Text color={t.color.accent} key={i}>
            {'| '}{line}{' '.repeat(pad)}{' |'}
          </Text>
        ))}

        {/* Spacer */}
        <Text color={t.color.accent}>|{' '.repeat(w - 2)}|</Text>

        {/* Subtitle: Khmer + callmemo */}
        <Text color={t.color.textMuted}>
          {'| '}{'Anakot · callmemo'.padEnd(w - 4, ' ')}{' |'}
        </Text>

        {/* Version + model */}
        <Text color={t.color.textDim}>
          {'| '}{`v${version ?? '0.0.0'} · ${model ?? 'connecting...'}`.padEnd(w - 4, ' ')}{' |'}
        </Text>

        {/* Spacer */}
        <Text color={t.color.accent}>|{' '.repeat(w - 2)}|</Text>

        {/* Bottom border */}
        <Text color={t.color.accent}>+{'-'.repeat(w - 2)}+</Text>
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
      <Text color={t.color.accent}>* </Text>
      <Text color={t.color.text}>Anakot</Text>
      <Text color={t.color.textDim}> v{version ?? '0.0.0'}</Text>
    </Box>
  )
}
