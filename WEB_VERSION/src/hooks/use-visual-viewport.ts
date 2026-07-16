import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Track `window.visualViewport.height` so the outer app container can be
 * constrained to the visible area when the mobile virtual keyboard opens.
 *
 * Most mobile browsers do NOT shrink `100dvh` / `100vh` when the keyboard
 * appears, so any `position: fixed; bottom: 0` element (like the chat
 * composer) gets hidden behind the keyboard.
 *
 * Returns `null` when `visualViewport` is unavailable (desktop, old
 * WebViews) — the caller falls back to `100dvh` in that case.
 */
export function useVisualViewport(): {
  /** The visual viewport height in px, or null when unavailable. */
  vvHeight: number | null
  /** True when the keyboard is estimated to be open (>100px drop). */
  keyboardOpen: boolean
} {
  const [vvHeight, setVvHeight] = useState<number | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const prevHeightRef = useRef<number | null>(null)

  const handleResize = useCallback(() => {
    const vv = window.visualViewport
    if (!vv) {
      setVvHeight(null)
      setKeyboardOpen(false)
      return
    }

    const h = vv.height
    setVvHeight(h)

    // Detect keyboard open/close by height delta.
    const prev = prevHeightRef.current
    if (prev !== null) {
      const diff = prev - h
      if (diff > 100) {
        // Dropped >100px → keyboard likely opened
        setKeyboardOpen(true)
      } else if (diff < -50) {
        // Rose >50px → keyboard likely closed
        setKeyboardOpen(false)
      }
      // Otherwise: small fluctuation (address bar, orientation) — ignore.
    }
    prevHeightRef.current = h
  }, [])

  useEffect(() => {
    const vv = window.visualViewport

    if (vv) {
      // Set initial height
      prevHeightRef.current = vv.height
      setVvHeight(vv.height)

      vv.addEventListener('resize', handleResize)
      return () => vv.removeEventListener('resize', handleResize)
    }

    // Fallback: set initial to null
    setVvHeight(null)
    return undefined
  }, [handleResize])

  return { vvHeight, keyboardOpen }
}
