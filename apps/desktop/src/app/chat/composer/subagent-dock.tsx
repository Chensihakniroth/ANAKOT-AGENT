import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { BrailleSpinner } from '@/components/ui/braille-spinner'
import { useI18n } from '@/i18n'
import { AlertCircle, ChevronDown, ChevronUp, Sparkles, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { activeGateway } from '@/store/gateway'
import { $subagentsBySession, type SubagentProgress } from '@/store/subagents'

interface SubagentDockProps {
  sessionId: string | null
}

export function SubagentDock({ sessionId }: SubagentDockProps) {
  const { t } = useI18n()
  const allSubagents = useStore($subagentsBySession)
  const items = useMemo(
    () => (sessionId ? (allSubagents[sessionId] ?? []) : []),
    [sessionId, allSubagents]
  )
  const live = useMemo(
    () => items.filter(item => item.status === 'running' || item.status === 'queued'),
    [items]
  )
  const [expanded, setExpanded] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now)
  const [interruptingId, setInterruptingId] = useState<string | null>(null)

  const hasLive = live.length > 0

  useEffect(() => {
    if (!hasLive) return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [hasLive])

  if (!hasLive) return null

  const handleInterrupt = async (subagentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const gateway = activeGateway()
    if (!gateway) return
    setInterruptingId(subagentId)
    try {
      await gateway.request('subagent.interrupt', { subagent_id: subagentId })
    } catch {
      // Ignored: interruption will reflect on event push
    } finally {
      setInterruptingId(null)
    }
  }

  const primary = live[0]
  const latestLine = primary?.stream.at(-1)?.text || (primary?.status === 'queued' ? 'Queued' : t.agents.running)

  return (
    <div
      className="composer-no-drag mb-1.5 overflow-hidden rounded-lg border border-primary/20 bg-background/95 shadow-sm backdrop-blur-md transition-all"
      data-slot="composer-subagent-dock"
    >
      {/* Header bar */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs select-none hover:bg-muted/40"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <BrailleSpinner
            ariaLabel={t.agents.running}
            className="size-3.5 shrink-0 text-primary"
            spinner="breathe"
          />
          <span className="font-medium text-foreground">
            {live.length === 1 ? '1 subagent running' : `${live.length} subagents running`}
          </span>
          <span className="truncate text-muted-foreground/80">
            — {primary?.goal ? `"${primary.goal}"` : latestLine}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {primary && (
            <ActivityTimerText
              className="text-[0.7rem] text-muted-foreground"
              seconds={Math.max(0, Math.floor((nowMs - primary.startedAt) / 1000))}
            />
          )}
          {expanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded roster */}
      {expanded && (
        <div className="max-h-48 divide-y divide-border/40 overflow-y-auto border-t border-border/40 px-1 py-1">
          {live.map(item => {
            const elapsed = Math.max(0, Math.floor((nowMs - item.startedAt) / 1000))
            const lastText = item.stream.at(-1)?.text || (item.status === 'queued' ? 'Queued' : item.goal)

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="truncate">{item.goal}</span>
                    {item.model && (
                      <span className="shrink-0 rounded bg-muted px-1 text-[0.65rem] text-muted-foreground">
                        {item.model}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[0.7rem] text-muted-foreground">
                    {lastText}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <ActivityTimerText className="text-[0.68rem] text-muted-foreground" seconds={elapsed} />
                  <button
                    type="button"
                    title="Stop subagent"
                    disabled={interruptingId === item.id}
                    onClick={e => void handleInterrupt(item.id, e)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
