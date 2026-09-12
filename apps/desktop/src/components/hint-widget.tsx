// Hint widget — contextual hint that surfaces a short tip near a target element.
// Auto-dismisses after a few seconds or on hover.

import React from 'react'
import { useRef, useEffect, type FC } from 'react'

import { cn } from '@/lib/utils'

interface HintWidgetProps {
  target?: HTMLElement | null
  text: string
  timeout?: number
  className?: string
}

export const HintWidget: FC<HintWidgetProps> = ({ target, text, timeout = 4000, className }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const timer = setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s' }, timeout)
    const onMouseEnter = () => clearTimeout(timer)
    el.addEventListener('mouseenter', onMouseEnter)
    return () => el.removeEventListener('mouseenter', onMouseEnter)
  }, [timeout])

  if (!target) return null

  return React.createElement('div', {
    ref,
    className: cn('fixed z-50 pointer-events-none animate-fade-in text-xs text-muted-foreground bg-background/90 border border-border rounded px-2 py-1 shadow-lg', className),
    style: { top: target.offsetTop + target.offsetHeight + 8, left: target.offsetLeft }
  }, text)
}
