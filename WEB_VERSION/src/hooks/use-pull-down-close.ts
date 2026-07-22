import { useEffect, useRef } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { triggerHaptic } from '@/lib/haptics'

const PULL_THRESHOLD = 100  // px — distance to trigger close
const MAX_DRIFT = 60        // px — horizontal tolerance

/**
 * Detect a top-to-bottom swipe gesture on the element and call `onPullClose`.
 * Designed for overlay panels on mobile — when the user pulls down from the
 * top of the panel, it dismisses. Only fires when the scroll position is at
 * the top (so pulling on scrolled content scrolls instead).
 *
 * Returns a `ref` to attach to the scrollable content area of the overlay.
 */
export function usePullDownClose(onPullClose: () => void) {
  const isMobile = useIsMobile()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMobile) return

    const el = ref.current
    if (!el) return

    let startY = 0
    let startX = 0
    let tracking = false

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return

      // Only start tracking if the scroll container is at the top
      if (el.scrollTop > 5) return

      startY = t.clientY
      startX = t.clientX
      tracking = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return

      const t = e.touches[0]
      if (!t) return

      const dy = t.clientY - startY
      const dx = Math.abs(t.clientX - startX)

      // Cancel if the user is swiping horizontally (not vertically)
      if (dx > MAX_DRIFT) {
        tracking = false
        return
      }

      // Allow the native scroll to handle it if we're not at the top anymore
      if (el.scrollTop > 5) {
        tracking = false
        return
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false

      const t = e.changedTouches[0]
      if (!t) return

      const dy = t.clientY - startY

      if (dy > PULL_THRESHOLD) {
        triggerHaptic('close')
        onPullClose()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, onPullClose])

  return ref
}
