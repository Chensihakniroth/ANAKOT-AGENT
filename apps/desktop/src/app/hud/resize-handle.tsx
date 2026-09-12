'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical' | 'corner'
  onResize: (deltaX: number, deltaY: number) => void
  className?: string
}

/** Draggable HUD resize handles. */
export const ResizeHandle: FC<ResizeHandleProps> = ({ direction, onResize, className }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      onResize(deltaX, deltaY)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute opacity-0 hover:opacity-100 transition-opacity',
        direction === 'horizontal' && 'right-0 top-0 bottom-0 w-1.5 cursor-ew-resize',
        direction === 'vertical' && 'bottom-0 left-0 right-0 h-1.5 cursor-ns-resize',
        direction === 'corner' && 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize',
        'bg-primary/30 rounded',
        className,
      )}
    />
  )
}
