import { Box, Text } from '@anakot/ink'

import type { Theme } from '../theme.js'
import type { Usage } from '../types.js'
import { fmtK } from '../lib/text.js'

// ── Context bar color thresholds ───────────────────────────────────────

function ctxBarColor(pct: number | undefined, t: Theme): string {
  if (pct == null) {
    return t.color.textMuted
  }
  if (pct >= 90) {
    return t.color.ctxCritical
  }
  if (pct > 70) {
    return t.color.ctxWarn
  }
  return t.color.ctxHealthy
}

// ── Progress bar (Unicode block characters) ────────────────────────────

function progressBar(pct: number | undefined, width: number, t: Theme): { bar: string; pctLabel: string } {
  const p = Math.max(0, Math.min(100, pct ?? 0))
  const filled = Math.round((p / 100) * width)
  const bar = '▉'.repeat(filled) + '░'.repeat(width - filled)
  const pctLabel = pct != null ? `${pct}%` : ''

  return { bar, pctLabel }
}

// ── Compact model label ────────────────────────────────────────────────

const shortModelLabel = (model: string) =>
  model
    .split('/')
    .pop()!
    .replace(/^claude[-_]/, '')
    .replace(/^anthropic[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b(\d+)\s+(\d+)\b/g, '$1.$2')
    .trim()

// ── StatusBar ───────────────────────────────────────────────────────────

export interface StatusBarProps {
  model: string
  usage?: Usage
  cost?: number
  busy?: boolean
  t: Theme
}

/**
 * Compact single-line status bar inspired by Claude Code's design.
 *
 * Layout (progressive disclosure):
 *
 *   ◆ model-name │ context-bar  N% │ cost
 *
 * - `◆` diamond brand mark in Anakot gold
 * - Model name (short label)
 * - Context fill bar with percentage (color-coded green → amber → red)
 * - Cost in green
 *
 * On very narrow terminals the cost drops first, then the context bar
 * collapses to a bare token count.
 */
export function StatusBar({ model, usage, cost, busy, t }: StatusBarProps) {
  const pct = usage?.context_percent
  const barColor = ctxBarColor(pct, t)
  const modelText = shortModelLabel(model)

  // Context label: "12.4K/200K" or "12.4K tok"
  const ctxLabel = usage?.context_max
    ? `${fmtK(usage.context_used ?? 0)}/${fmtK(usage.context_max)}`
    : usage && usage.total > 0
      ? `${fmtK(usage.total)} tok`
      : ''

  const { bar, pctLabel } = progressBar(pct, 12, t)
  const costText = typeof cost === 'number' && cost > 0 ? `$${cost.toFixed(4)}` : ''

  return (
    <Box flexDirection="row">
      {/* Brand diamond + model */}
      <Text color={t.color.accent}>◆ </Text>
      <Text color={t.color.text}>{modelText}</Text>

      {/* Context bar */}
      {ctxLabel && (
        <>
          <Text color={t.color.textMuted}> │ </Text>
          <Text color={barColor}>{bar}</Text>
          <Text color={t.color.textMuted}> {pctLabel}</Text>
          <Text color={t.color.textDim}> {ctxLabel}</Text>
        </>
      )}

      {/* Cost */}
      {costText && (
        <>
          <Text color={t.color.textMuted}> │ </Text>
          <Text color={t.color.ok}>{costText}</Text>
        </>
      )}

      {/* Busy indicator */}
      {busy && (
        <>
          <Text color={t.color.textMuted}> │ </Text>
          <Text color={t.color.accent}>◇</Text>
        </>
      )}
    </Box>
  )
}
