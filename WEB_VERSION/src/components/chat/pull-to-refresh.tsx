import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface PullToRefreshOverlayProps {
  /** Called when the user pulls past the threshold and releases. */
  onRefresh?: () => void | Promise<void>
  /** CSS selector for the scrollable container inside children. Required on
   *  mobile so the hook knows when the user is at scroll position 0. */
  scrollSelector?: string
  /** Children — expected to contain a scrollable element matching `scrollSelector`. */
  children?: ReactNode
}

/**
 * Pull-to-refresh overlay for mobile. Renders a translucent pull indicator
 * at the top of the chat area. The actual scroll container is the child
 * element marked with `data-pull-scroll`.
 *
 * On desktop this renders nothing extra.
 */
export function PullToRefreshOverlay({ onRefresh, scrollSelector, children }: PullToRefreshOverlayProps) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return <>{children}</>
  }

  return <PullHandler onRefresh={onRefresh} scrollSelector={scrollSelector}>{children}</PullHandler>
}

function PullHandler({ onRefresh, scrollSelector, children }: PullToRefreshOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const startYRef = useRef(0)
  const currentPullRef = useRef(0)
  const pullingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const threshold = 80
  const maxPull = 120

  /** Find the scroll container matching the selector, or fall back to the root element. */
  const scrollEl = useCallback(() => {
    if (scrollSelector) {
      return rootRef.current?.querySelector<HTMLElement>(scrollSelector) ?? null
    }
    // Default: the root element itself should be the scroll container
    return rootRef.current
  }, [scrollSelector])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const el = scrollEl()
    if (!el || e.pointerType !== 'touch') return
    if (el.scrollTop > 2) return

    pullingRef.current = true
    startYRef.current = e.clientY
    currentPullRef.current = 0
    setPulling(true)
    setPullDistance(0)
  }, [scrollEl])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!pullingRef.current) return
    const deltaY = e.clientY - startYRef.current
    if (deltaY <= 0) {
      pullingRef.current = false
      setPulling(false)
      setPullDistance(0)
      currentPullRef.current = 0
      return
    }
    const distance = Math.min(deltaY * 0.5, maxPull)
    currentPullRef.current = distance
    setPullDistance(distance)
  }, [maxPull])

  const handlePointerUp = useCallback(async () => {
    if (!pullingRef.current) return
    pullingRef.current = false
    setPulling(false)

    if (currentPullRef.current >= threshold) {
      setRefreshing(true)
      try {
        await onRefresh?.()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
        currentPullRef.current = 0
      }
    } else {
      setPullDistance(0)
      currentPullRef.current = 0
    }
  }, [onRefresh, threshold])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerUp)
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUp)
      el.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp])

  const progress = Math.min(pullDistance / threshold, 1)
  const show = refreshing || pulling

  return (
    <div ref={rootRef} className="relative h-full">
      {/* Pull indicator */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 z-10 -translate-x-1/2',
          show ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: refreshing ? 12 : Math.max(pullDistance - 24, -24),
          transitionDuration: pulling ? '0ms' : '300ms',
          transitionProperty: 'top, opacity',
          transitionTimingFunction: 'ease-out'
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-(--dt-secondary) px-3 py-1.5 text-xs text-(--dt-secondary-foreground) shadow-sm">
          {refreshing ? (
            <>
              <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Refreshing…</span>
            </>
          ) : (
            <>
              <svg
                className="size-3 transition-transform"
                style={{ transform: `rotate(${progress * 180}deg)` }}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M2 8h12M8 2l6 6-6 6" />
              </svg>
              <span>{pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh'}</span>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
