'use client'
import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { $composerStatus } from '@/store/composer-status'
import { cn } from '@/lib/utils'

interface VoiceMenuProps {
  sessionId: string
  className?: string
}

/** Enhanced voice input menu with status indicator. */
export const VoiceMenu: FC<VoiceMenuProps> = ({ sessionId, className }) => {
  const statusBySession = useStore($composerStatus)
  const status = statusBySession[sessionId] ?? 'idle'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'h-2 w-2 rounded-full transition-colors',
          status === 'streaming' && 'animate-pulse bg-green-500',
          status === 'error' && 'bg-red-500',
          status === 'idle' && 'bg-muted-foreground/30',
          status === 'awaiting' && 'bg-yellow-500',
        )}
        aria-hidden
      />
      <span className="text-xs text-muted-foreground">
        {status === 'idle' && 'Ready'}
        {status === 'streaming' && 'Listening...'}
        {status === 'awaiting' && 'Processing...'}
        {status === 'error' && 'Error'}
      </span>
    </div>
  )
}
