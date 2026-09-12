'use client'

import { type FC, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const DEFAULT_TIPS = [
  'Type @ to reference a file or folder',
  'Use / for slash commands',
  'Press ↑ to edit your last message',
  'Shift+Enter for a new line',
  'Ctrl/Cmd+K to open the command center',
]

/** Hook that rotates through tips at a configurable interval. */
export function useTipRotation(tips: string[] = DEFAULT_TIPS, intervalMs = 15_000): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % tips.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [tips.length, intervalMs])

  return tips[index]
}

interface TipBubbleProps {
  tips?: string[]
  className?: string
}

/** A small floating tip bubble that rotates through helpful hints. */
export const TipBubble: FC<TipBubbleProps> = ({ tips, className }) => {
  const tip = useTipRotation(tips)

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground',
        'animate-in fade-in slide-in-from-bottom-1 duration-300',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      💡 {tip}
    </div>
  )
}
