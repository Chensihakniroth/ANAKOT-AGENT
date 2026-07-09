import { useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { $gitLog, clearGitLog, type GitLogEntry } from '@/store/git-log'
import { cn } from '@/lib/utils'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogEntryRow({ entry }: { entry: GitLogEntry }) {
  const expandedRef = useRef<HTMLDivElement>(null)
  const isError = entry.level === 'error'
  const isWarning = entry.level === 'warning'

  return (
    <div
      className={cn(
        'group select-text border-b border-(--ui-stroke-tertiary)/50 px-3 py-1.5 font-mono text-[0.65rem]',
        isError && 'bg-red-500/5',
        isWarning && 'bg-amber-500/5',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground/60">{formatTime(entry.timestamp)}</span>
        <Codicon
          name={
            isError ? 'error' : isWarning ? 'warning' : entry.level === 'success' ? 'check' : 'info'
          }
          size="0.65rem"
          className={cn(
            'shrink-0',
            isError && 'text-red-400',
            isWarning && 'text-amber-400',
            entry.level === 'success' && 'text-green-400',
            entry.level === 'info' && 'text-blue-400',
          )}
        />
        <span
          className={cn(
            'flex-1 truncate',
            isError && 'text-red-300',
            isWarning && 'text-amber-300',
            entry.level === 'success' && 'text-green-300/90',
            entry.level === 'info' && 'text-foreground/80',
          )}
        >
          {entry.summary}
        </span>
        <span className="shrink-0 text-muted-foreground/40">{entry.cwd.split('/').pop() ?? entry.cwd}</span>
      </div>

      {/* Full command line */}
      <div className="mt-0.5 truncate pl-12 text-muted-foreground/50">
        $ {entry.fullCommand}
      </div>

      {/* Error output */}
      {isError && entry.stderr && (
        <div
          ref={expandedRef}
          className="mt-1 whitespace-pre-wrap break-all rounded-sm bg-red-500/10 px-2 py-1 text-red-300/80"
        >
          {entry.stderr}
        </div>
      )}

      {/* Warning output */}
      {isWarning && entry.stderr && (
        <div className="mt-1 whitespace-pre-wrap break-all rounded-sm bg-amber-500/10 px-2 py-1 text-amber-300/80">
          {entry.stderr}
        </div>
      )}

      {/* Success output (stdout) — only show if there's meaningful output */}
      {entry.level === 'success' && entry.stdout && entry.command !== 'status' && (
        <div className="mt-0.5 whitespace-pre-wrap break-all pl-12 text-muted-foreground/40">
          {entry.stdout}
        </div>
      )}
    </div>
  )
}

export function GitOutputPanel() {
  const log = useStore($gitLog)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [log.length])

  if (log.length === 0) {
    return (
      <div ref={rootRef} className="flex h-full w-full items-center justify-center text-xs text-muted-foreground/50">
        No git activity yet. Stage, commit, or modify files to see git output here.
      </div>
    )
  }

  return (
    <div ref={rootRef} className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-(--ui-stroke-tertiary) bg-(--ui-tab-inactive-background) px-3 py-1">
        <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground/60">
          Git ({log.length} {log.length === 1 ? 'entry' : 'entries'})
        </span>
        <button
          className="rounded-sm px-2 py-0.5 text-[0.6rem] text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={clearGitLog}
          type="button"
          title="Clear"
        >
          <Codicon name="trash" size="0.6rem" />
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto select-text">
        {log.map(entry => (
          <LogEntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
