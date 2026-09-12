'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { $activeSessionId } from '@/store/session'
import { cn } from '@/lib/utils'

interface RouteTileProps {
  sessionId: string
  title?: string
  subtitle?: string
  className?: string
}

/** Session tile in route view — compact list item for the route sidebar. */
export const RouteTile: FC<RouteTileProps> = ({ sessionId, title, subtitle, className }) => {
  const activeId = useStore($activeSessionId)
  const isActive = sessionId === activeId

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-accent/50 cursor-pointer',
        isActive && 'bg-accent text-accent-foreground',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title ?? sessionId}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}
