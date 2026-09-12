'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

interface IdleMountProps {
  children: ReactNode
  /** Time in ms before the component unmounts when not visible. Default 30s. */
  idleTimeout?: number
  /** Placeholder to render when unmounted. */
  placeholder?: ReactNode
  className?: string
}

/**
 * Unmount hidden tabs after an idle timeout to reduce DOM/memory pressure.
 * Re-mounts when the element becomes visible again (via IntersectionObserver).
 */
export function IdleMount({ children, idleTimeout = 30_000, placeholder, className }: IdleMountProps) {
  const [mounted, setMounted] = useState(true)
  const [visible, setVisible] = useState(true)
  const elRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting)
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      if (timerRef.current) clearTimeout(timerRef.current)
    } else {
      timerRef.current = setTimeout(() => setMounted(false), idleTimeout)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, idleTimeout])

  return (
    <div ref={elRef} className={className}>
      {mounted ? children : (placeholder ?? <div className="h-full w-full animate-pulse bg-muted/20" />)}
    </div>
  )
}
