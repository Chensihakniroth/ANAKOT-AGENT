'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { $activeSessionId, $sessions } from '@/store/session'
import { cn } from '@/lib/utils'

interface SessionPickerProps {
  onSelect?: (sessionId: string) => void
  className?: string
}

/** Session picker tile component — a compact list item for session selection. */
export const SessionPicker: FC<SessionPickerProps> = ({ onSelect, className }) => {
  const activeId = useStore($activeSessionId)
  const sessions = useStore($sessions)

  return (
    <div className={cn('flex flex-col gap-0.5', className)} role="listbox" aria-label="Sessions">
      {sessions.map(session => (
        <button
          key={session.id}
          role="option"
          aria-selected={session.id === activeId}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
            'hover:bg-accent/50',
            session.id === activeId && 'bg-accent text-accent-foreground',
          )}
          onClick={() => onSelect?.(session.id)}
        >
          <span className="truncate">{session.title ?? session.id}</span>
        </button>
      ))}
    </div>
  )
}
