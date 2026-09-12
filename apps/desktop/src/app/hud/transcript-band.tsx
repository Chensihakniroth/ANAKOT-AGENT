'use client'

import { type FC, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TranscriptBandProps {
  children: ReactNode
  className?: string
}

/** Floating transcript band — minimal horizontal display. */
export const TranscriptBand: FC<TranscriptBandProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full bg-background/90 border border-border/50 px-4 py-2',
        'shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
