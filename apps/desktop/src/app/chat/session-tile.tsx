'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { $activeSessionId, $sessions } from '@/store/session'
import { cn } from '@/lib/utils'

interface SessionTileProps {
  sessionId: string
  className?: string
}

/** Rich session tile with status dot, title, and active state. */
export const SessionTile: FC<SessionTileProps> = ({ sessionId, className }) => {
  const activeId = useStore($activeSessionId)
  const sessions = useStore($sessions)
  const session = sessions.find(s => s.id === sessionId)
  const isActive = sessionId === activeId

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        'hover:bg-accent/50 cursor-pointer',
        isActive && 'bg-accent text-accent-foreground',
        className,
      )}
    >
      <div
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isActive ? 'bg-green-500' : 'bg-muted-foreground/30',
        )}
        aria-hidden
      />
      <span className="truncate">{session?.title ?? sessionId}</span>
    </div>
  )
}
