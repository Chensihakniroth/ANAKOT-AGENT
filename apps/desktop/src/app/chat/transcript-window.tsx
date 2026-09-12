'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface TranscriptWindowProps {
  children: React.ReactNode
  className?: string
}

/** Windowed transcript rendering — only renders visible messages. */
export const TranscriptWindow: FC<TranscriptWindowProps> = ({ children, className }) => {
  return (
    <div className={cn('flex flex-col gap-2 overflow-y-auto', className)}>
      {children}
    </div>
  )
}
