import { useRef, useCallback, useEffect, type RefCallback } from 'react'

interface UseSwipeNavigationOptions {
  /** Called when a right-swipe (back gesture) is detected. */
  onBack?: () => void
  /** Minimum horizontal distance in px to qualify as a swipe (default: 80). */
  threshold?: number
  /** Minimum velocity in px/s to qualify as a swipe (default: 500). */
  velocityThreshold?: number
  /** Width of the left-edge zone in px where back-swipe is active (default: 40). */
  edgeZone?: number
}

/** Result of useSwipeNavigation — attach this as a ref on your container. */
interface UseSwipeNavigationResult {
  ref: RefCallback<HTMLElement>
}

/**
 * Detects horizontal swipe gestures via raw touch events.
 * Phase 1: swipe-right from left edge → triggers back navigation.
 *
 * Usage:
 *   const { ref } = useSwipeNavigation({ onBack: closeOverlay })
 *   <div ref={ref}>...</div>
 */
export function useSwipeNavigation({
  onBack,
  threshold = 80,
  velocityThreshold = 500,
  edgeZone = 40,
}: UseSwipeNavigationOptions): UseSwipeNavigationResult {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const swipingRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      // Only activate back-swipe when starting from the left edge
      if (touch.clientX > edgeZone) {
        touchStartRef.current = null
        return
      }

      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      swipingRef.current = false
    },
    [edgeZone],
  )

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    if (!touch) return

    const dx = touch.clientX - touchStartRef.current.x
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)

    // If vertical scroll dominates, cancel the swipe gesture
    if (dy > Math.abs(dx) * 1.5) {
      touchStartRef.current = null
      return
    }

    // Only mark as swiping if we've moved enough horizontally
    if (dx > 20) {
      swipingRef.current = true
    }
  }, [])

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartRef.current
      touchStartRef.current = null

      if (!start || !swipingRef.current) {
        swipingRef.current = false
        return
      }

      swipingRef.current = false

      const touch = e.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dt = Date.now() - start.time
      const velocity = dt > 0 ? dx / (dt / 1000) : 0

      // Swipe right from left edge → back navigation
      if (dx >= threshold || velocity >= velocityThreshold) {
        onBack?.()
      }
    },
    [onBack, threshold, velocityThreshold],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const attach = useCallback(
    (el: HTMLElement | null) => {
      // Detach previous
      cleanupRef.current?.()

      if (!el) return

      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: true })
      el.addEventListener('touchend', onTouchEnd, { passive: true })

      cleanupRef.current = () => {
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('touchend', onTouchEnd)
      }
    },
    [onTouchEnd, onTouchMove, onTouchStart],
  )

  return { ref: attach }
}
