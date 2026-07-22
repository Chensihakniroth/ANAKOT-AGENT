import { useEffect, useRef, useState } from 'react'

/**
 * Track the on-screen keyboard on mobile via the VisualViewport API.
 *
 * On iOS/Android the keyboard pushes the visual viewport up while the
 * layout viewport stays put. This hook exposes:
 *
 * - `keyboardOpen` — true when the keyboard is visible (height delta > 100px)
 * - `keyboardHeight` — current keyboard height in px (0 when closed)
 *
 * The hook also sets a CSS custom property `--mobile-keyboard-height` on
 * the document root so CSS rules can react to the keyboard without JS.
 */
export function useMobileKeyboard() {
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const KBD_THRESHOLD = 100 // px — treat height deltas below this as scroll, not keyboard

    const onResize = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const height = window.innerHeight - (vv.height + vv.offsetTop)
        const open = height > KBD_THRESHOLD

        setKeyboardOpen(open)
        setKeyboardHeight(Math.max(0, height))
        document.documentElement.style.setProperty(
          '--mobile-keyboard-height',
          `${Math.max(0, height)}px`,
        )
      })
    }

    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    // Also handle orientation changes which reset the viewport
    window.addEventListener('orientationchange', onResize)

    // Clean up on unmount: reset the CSS variable
    return () => {
      cancelAnimationFrame(rafRef.current)
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
      window.removeEventListener('orientationchange', onResize)
      document.documentElement.style.setProperty('--mobile-keyboard-height', '0px')
    }
  }, [])

  return { keyboardOpen, keyboardHeight }
}
