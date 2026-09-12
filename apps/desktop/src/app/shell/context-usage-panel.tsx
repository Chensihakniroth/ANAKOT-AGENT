'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'
import type { UsageStats } from '@/types/anakot'

interface ContextUsagePanelProps {
  usage: UsageStats
  className?: string
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums font-medium', color)}>{value}</span>
    </div>
  )
}

/** Rich context usage panel — upgrade from the popover to a full panel. */
export const ContextUsagePanel: FC<ContextUsagePanelProps> = ({ usage, className }) => {
  const contextPercent = usage.context_percent ?? (usage.context_max
    ? Math.round((usage.total / usage.context_max) * 100)
    : null)

  return (
    <div className={cn('rounded-lg border border-border/30 bg-muted/10 p-4', className)}>
      <h3 className="mb-3 text-sm font-medium">Context Usage</h3>
      <div className="space-y-1">
        <StatRow label="Input tokens" value={usage.input?.toLocaleString() ?? '—'} />
        <StatRow label="Output tokens" value={usage.output?.toLocaleString() ?? '—'} />
        <StatRow label="Total tokens" value={usage.total?.toLocaleString() ?? '—'} />
        <StatRow label="API calls" value={usage.calls?.toLocaleString() ?? '—'} />
        {contextPercent !== null && (
          <StatRow
            label="Context window"
            value={`${contextPercent}%`}
            color={contextPercent > 80 ? 'text-red-500' : contextPercent > 60 ? 'text-yellow-500' : 'text-green-500'}
          />
        )}
      </div>
    </div>
  )
}
