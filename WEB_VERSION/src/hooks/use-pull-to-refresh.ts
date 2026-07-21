import { useCallback, useEffect, useRef, useState } from 'react'

interface UsePullToRefreshOptions {
  /** Called when the user pulls past the threshold and releases. */
  onRefresh?: () => void | Promise<void>
  /** Pull distance in px required to trigger a refresh (default: 80). */
  threshold?: number
  /** Max pull distance in px before a hard stop (default: 120). */
  maxPull?: number
  /** Element selector for the scrollable container. If not provided, the
   *  ref'd element itself is expected to be the scroll container. */
  scrollSelector?: string
}

interface UsePullToRefreshResult {
  /** Attach to the scrollable container. */
  ref: (el: HTMLElement | null) => void
  /** Current pull distance (0 when idle) — use for visual indicator. */
  pullDistance: number
  /** True while the refresh callback is executing. */
  refreshing: boolean
  /** True while the user is actively pulling. */
  pulling: boolean
}

/**
 * Pull-to-refresh for mobile chat threads. Tracks pointer events on the
 * scrollable container and triggers `onRefresh` when the user pulls down past
 * `threshold` px from the top (scrollTop <= 0).
 *
 * The indicator state (pullDistance, pulling, refreshing) can be used to render
 * a visual overlay.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  scrollSelector
}: UsePullToRefreshOptions = {}): UsePullToRefreshResult {
  const elRef = useRef<HTMLElement | null>(null)
  const startYRef = useRef(0)
  const currentPullRef = useRef(0)
  const pullingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  /** Get the actual scrollable element (resolve selector if provided). */
  const scrollEl = useCallback(() => {
    if (scrollSelector && elRef.current) {
      return elRef.current.querySelector<HTMLElement>(scrollSelector)
    }
    return elRef.current
  }, [scrollSelector])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const el = scrollEl()
    if (!el || e.pointerType !== 'touch') return

    // Only activate when scrolled to the top (with tiny tolerance)
    if (el.scrollTop > 2) return

    pullingRef.current = true
    startYRef.current = e.clientY
    currentPullRef.current = 0
    setPulling(true)
    setPullDistance(0)

    el.setPointerCapture(e.pointerId)
  }, [scrollEl])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!pullingRef.current) return

    const deltaY = e.clientY - startYRef.current
    if (deltaY <= 0) {
      // Scrolling upward (normal scroll) — stop pull
      pullingRef.current = false
      setPulling(false)
      setPullDistance(0)
      currentPullRef.current = 0
      return
    }

    // Apply resistance: the further you pull, the harder it gets
    const distance = Math.min(deltaY * 0.5, maxPull)
    currentPullRef.current = distance
    setPullDistance(distance)
  }, [maxPull])

  const handlePointerUp = useCallback(async () => {
    if (!pullingRef.current) return

    pullingRef.current = false
    setPulling(false)

    if (currentPullRef.current >= threshold) {
      // Trigger refresh
      setRefreshing(true)
      try {
        await onRefresh?.()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
        currentPullRef.current = 0
      }
    } else {
      // Snap back
      setPullDistance(0)
      currentPullRef.current = 0
    }
  }, [onRefresh, threshold])

  useEffect(() => {
    const el = elRef.current
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

  return {
    ref: (el) => { elRef.current = el },
    pullDistance,
    refreshing,
    pulling
  }
}
