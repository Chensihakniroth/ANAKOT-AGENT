import { useCallback, useEffect, useRef } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { triggerHaptic } from '@/lib/haptics'

const SWIPE_THRESHOLD = 80   // px — minimum horizontal distance to trigger
const SWIPE_MAX_Y = 50       // px — vertical tolerance (prevents accidental triggers while scrolling)
const EDGE_MARGIN = 40       // px — how close to the left edge a swipe must start

/**
 * Detect a right-to-left swipe gesture on the element and call `onSwipeBack`.
 * Designed for mobile thread views where swiping right returns to the session
 * list. The handler only fires when:
 *
 * 1. The swipe starts within `EDGE_MARGIN` px of the left edge of the element.
 * 2. The horizontal distance exceeds `SWIPE_THRESHOLD`.
 * 3. The vertical drift is less than `SWIPE_MAX_Y`.
 *
 * Returns a `ref` to attach to the scroll container.
 */
export function useSwipeBack(onSwipeBack: () => void) {
  const isMobile = useIsMobile()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMobile) return

    const el = ref.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return

      // Only start tracking if the touch is near the left edge
      const rect = el.getBoundingClientRect()
      if (t.clientX - rect.left > EDGE_MARGIN) return

      startX = t.clientX
      startY = t.clientY
      tracking = true
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false

      const t = e.changedTouches[0]
      if (!t) return

      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)

      if (dx > SWIPE_THRESHOLD && dy < SWIPE_MAX_Y) {
        triggerHaptic('selection')
        onSwipeBack()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, onSwipeBack])

  return ref
}
