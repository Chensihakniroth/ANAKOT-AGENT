'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface HandoffProps {
  fromWindow?: string
  toWindow?: string
  className?: string
}

/** HUD handoff between windows — visual indicator during window transitions. */
export const Handoff: FC<HandoffProps> = ({ fromWindow, toWindow, className }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {fromWindow && <span>{fromWindow}</span>}
      <span>→</span>
      {toWindow && <span>{toWindow}</span>}
    </div>
  )
}
