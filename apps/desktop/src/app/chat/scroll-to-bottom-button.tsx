'use client'

import { type FC, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface ScrollToBottomButtonProps {
  targetRef: React.RefObject<HTMLElement | null>
  className?: string
}

/** Floating scroll-to-bottom button that appears when scrolled up. */
export const ScrollToBottomButton: FC<ScrollToBottomButtonProps> = ({ targetRef, className }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setVisible(distanceFromBottom > 200)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [targetRef])

  if (!visible) return null

  return (
    <button
      onClick={() => targetRef.current?.scrollTo({ top: targetRef.current.scrollHeight, behavior: 'smooth' })}
      className={cn(
        'absolute bottom-4 left-1/2 z-10 -translate-x-1/2',
        'flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg',
        'hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2',
        className,
      )}
    >
      <span>↓</span>
      <span>New messages</span>
    </button>
  )
}
