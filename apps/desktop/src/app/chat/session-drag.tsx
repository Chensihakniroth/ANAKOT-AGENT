'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface SessionDragProps {
  sessionId: string
  children: React.ReactNode
  className?: string
}

/** Drag wrapper for sessions — enables drag-and-drop between panes. */
export const SessionDrag: FC<SessionDragProps> = ({ sessionId, children, className }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-session-id', sessionId)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div draggable onDragStart={handleDragStart} className={cn('cursor-grab active:cursor-grabbing', className)}>
      {children}
    </div>
  )
}
