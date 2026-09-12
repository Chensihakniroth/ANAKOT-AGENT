'use client'

import { useStore } from '@nanostores/react'
import { type FC, type ReactNode } from 'react'

import { $activeSessionId } from '@/store/session'
import { cn } from '@/lib/utils'

interface ThreadFocusProps {
  sessionId: string
  children: ReactNode
  className?: string
}

/** HUD focus follow for active thread — highlights the active session. */
export const ThreadFocus: FC<ThreadFocusProps> = ({ sessionId, children, className }) => {
  const activeId = useStore($activeSessionId)
  const isActive = sessionId === activeId

  return (
    <div
      className={cn(
        'rounded-md transition-all',
        isActive && 'ring-2 ring-primary/50 bg-primary/5',
        className,
      )}
    >
      {children}
    </div>
  )
}
