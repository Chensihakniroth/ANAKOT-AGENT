'use client'

import { type FC, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface GameOverlayProps {
  children: ReactNode
  className?: string
}

/** Game-style overlay surface — dark, minimal chrome. */
export const GameOverlay: FC<GameOverlayProps> = ({ children, className }) => {
  return (
    <div className={cn('rounded-lg bg-black/80 border border-white/5 p-4 text-white', className)}>
      {children}
    </div>
  )
}
