import { useEffect, useState } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Codicon } from '@/components/ui/codicon'
import { triggerHaptic } from '@/lib/haptics'

/**
 * Floating action button that appears when the user scrolls up in the chat
 * thread, allowing them to jump back to the latest message. Only rendered on
 * mobile devices (small screens).
 *
 * It queries the thread viewport via `[data-slot="aui_thread-viewport"]` and
 * listens to its scroll events.
 */
export function ScrollToBottomFab() {
  const isMobile = useIsMobile()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isMobile) return

    const vp = document.querySelector<HTMLElement>('[data-slot="aui_thread-viewport"]')
    if (!vp) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        // Show when scrolled more than 120px from the bottom
        const distanceFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight
        setVisible(distanceFromBottom > 120)
        ticking = false
      })
    }

    vp.addEventListener('scroll', onScroll, { passive: true })
    // Also re-check on resize (viewport changes, new messages, etc.)
    const ro = new ResizeObserver(onScroll)
    ro.observe(vp)

    return () => {
      vp.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [isMobile])

  if (!isMobile || !visible) return null

  const scrollToBottom = () => {
    triggerHaptic('selection')
    const vp = document.querySelector<HTMLElement>('[data-slot="aui_thread-viewport"]')
    if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' })
  }

  return (
    <button
      aria-label="Scroll to latest message"
      className={cn(
        'scroll-to-bottom-fab',
        'pointer-events-auto fixed bottom-20 right-4 z-30',
        'flex size-10 items-center justify-center rounded-full',
        'border border-(--ui-stroke-secondary) bg-(--ui-control-background)',
        'text-(--ui-text-secondary) shadow-md backdrop-blur-sm',
        'active:scale-95 transition-all duration-150',
      )}
      onClick={scrollToBottom}
      type="button"
    >
      <Codicon name="chevron-down" size="1.25rem" />
    </button>
  )
}
