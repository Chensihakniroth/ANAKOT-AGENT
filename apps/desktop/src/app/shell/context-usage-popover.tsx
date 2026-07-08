/**
 * ContextUsagePopover — detailed token usage breakdown in a statusbar popover.
 *
 * Shows input tokens, output tokens, total, API calls, and context-window
 * utilisation (when the backend reports context_max).
 */
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { formatK } from '@/lib/statusbar'
import { cn } from '@/lib/utils'
import type { UsageStats } from '@/types/anakot'

interface ContextUsagePopoverProps {
  usage: UsageStats
  children?: React.ReactNode
}

function StatRow({
  label,
  value,
  color
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-0.5 text-[0.75rem]">
      <span className="text-muted-foreground/80">{label}</span>
      <span className={cn('tabular-nums font-medium text-foreground/90', color)}>{value}</span>
    </div>
  )
}

function Separator() {
  return <div className="my-1 h-px bg-border/40" />
}

export function ContextUsagePopover({ usage, children }: ContextUsagePopoverProps) {
  const { t } = useI18n()
  const copy = t.shell.statusbar

  const inputFormatted = formatK(usage.input)
  const outputFormatted = formatK(usage.output)
  const totalFormatted = formatK(usage.total)
  const callsFormatted = String(usage.calls ?? 0)

  const hasContextMax = typeof usage.context_max === 'number' && usage.context_max > 0
  const contextPercent = hasContextMax ? Math.round(usage.context_percent ?? 0) : null
  const contextUsedFormatted = hasContextMax ? formatK(usage.context_used ?? 0) : null
  const contextMaxFormatted = hasContextMax ? formatK(usage.context_max!) : null

  const costFormatted =
    typeof usage.cost_usd === 'number' && usage.cost_usd > 0
      ? `$${usage.cost_usd.toFixed(usage.cost_usd < 1 ? 4 : 2)}`
      : null

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-64" side="top" sideOffset={6}>
        <div className="px-1 pb-1 pt-0.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
            {copy.contextUsage}
          </span>
        </div>

        <StatRow label={copy.contextInput} value={inputFormatted} />
        <StatRow label={copy.contextOutput} value={outputFormatted} />
        <StatRow label={copy.contextTotal} value={totalFormatted} color="text-foreground" />
        <Separator />
        <StatRow label={copy.contextCalls} value={callsFormatted} />

        {hasContextMax && contextPercent !== null && (
          <>
            <Separator />
            <StatRow label={copy.contextWindow} value={`${contextUsedFormatted} / ${contextMaxFormatted}`} />
            <StatRow
              label={copy.contextUtilisation}
              value={`${contextPercent}%`}
              color={
                contextPercent > 90
                  ? 'text-amber-500'
                  : contextPercent > 75
                    ? 'text-amber-400/80'
                    : undefined
              }
            />
            {/* Mini bar */}
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/50">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  contextPercent > 90
                    ? 'bg-amber-500'
                    : contextPercent > 75
                      ? 'bg-amber-400/70'
                      : 'bg-primary/60'
                )}
                style={{ width: `${Math.min(100, contextPercent)}%` }}
              />
            </div>
          </>
        )}

        {costFormatted && (
          <>
            <Separator />
            <StatRow label={copy.contextCost} value={costFormatted} />
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
