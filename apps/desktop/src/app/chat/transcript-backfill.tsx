'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface TranscriptBackfillProps {
  sessionId: string
  onRequestBackfill?: (sessionId: string, beforeTimestamp: number) => void
  className?: string
}

/** Backfill missing transcript segments when scrolling to the top. */
export const TranscriptBackfill: FC<TranscriptBackfillProps> = ({ sessionId, onRequestBackfill, className }) => {
  return (
    <div className={cn('flex justify-center py-2', className)}>
      <button
        onClick={() => onRequestBackfill?.(sessionId, Date.now())}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Load earlier messages
      </button>
    </div>
  )
}
