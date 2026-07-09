import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { $activeFilePath } from '@/store/workbench'
import { $selectedStoredSessionId, $sessions } from '@/store/session'
import { cn } from '@/lib/utils'

export function BreadcrumbBar() {
  const activeFilePath = useStore($activeFilePath)
  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)

  const session = sessions.find(s => s.id === selectedSessionId)
  const sessionTitle = session?.title || null

  const fileLabel = activeFilePath
    ? activeFilePath.split(/[\\/]/).pop() || activeFilePath
    : null

  if (!sessionTitle && !fileLabel) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 truncate text-[0.65rem] text-muted-foreground/70',
        'max-w-[400px] [-webkit-app-region:no-drag]'
      )}
    >
      {sessionTitle && (
        <>
          <Codicon name="symbol-file" size="0.625rem" className="shrink-0" />
          <span className="truncate">{sessionTitle}</span>
        </>
      )}
      {fileLabel && (
        <>
          <Codicon name="chevron-right" size="0.5rem" className="shrink-0" />
          <Codicon name="file-code" size="0.625rem" className="shrink-0" />
          <span className="truncate">{fileLabel}</span>
        </>
      )}
    </div>
  )
}
