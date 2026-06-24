import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { $selectedStoredSessionId, $sessions, $currentModel, $activeSessionId } from '@/store/session'
import { cn } from '@/lib/utils'

export function SessionTab() {
  const selectedId = useStore($selectedStoredSessionId)
  const activeId = useStore($activeSessionId)
  const sessions = useStore($sessions)
  const model = useStore($currentModel)

  const session = sessions.find(s => s.id === selectedId)
  if (!session) return null

  const isActive = activeId !== null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors',
        'bg-(--ui-control-active-background)/50 text-foreground'
      )}
    >
      <Codicon name="symbol-file" size="0.625rem" className="text-muted-foreground" />
      <span className="max-w-[120px] truncate font-medium">
        {session.title || 'Untitled'}
      </span>
      {model && (
        <span className="rounded-sm bg-(--bg-quaternary) px-1 py-0.5 text-[0.55rem] text-muted-foreground">
          {model}
        </span>
      )}
      {!isActive && (
        <span className="text-[0.55rem] text-muted-foreground/50">idle</span>
      )}
    </div>
  )
}
