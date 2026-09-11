import { useEffect } from 'react'
import { useStore } from '@nanostores/react'

import { $wakeFired, $wakeWord } from '@/store/wake-word'
import { $wakeIndicatorState, setWakeIndicatorState, showWakeIndicator, hideWakeIndicator } from '@/store/wake-indicator'

/**
 * Integrates the wake indicator window with wake-word detection state.
 * Shows a pulsing light when listening, flashes on detection.
 * Mount once near the top of the app.
 */
export function useWakeIndicatorIntegration(): void {
  const wake = useStore($wakeWord)
  const fired = useStore($wakeFired)
  const indicatorState = useStore($wakeIndicatorState)

  // Show/hide based on wake word listening state
  useEffect(() => {
    const listening = Boolean(wake.status?.listening)

    if (listening && indicatorState === 'hidden') {
      showWakeIndicator()
      setWakeIndicatorState('listening')
    } else if (!listening && indicatorState !== 'hidden') {
      hideWakeIndicator()
    }
  }, [wake.status?.listening, indicatorState])

  // Flash on detection
  useEffect(() => {
    if (fired && indicatorState === 'listening') {
      setWakeIndicatorState('detected')

      // Return to listening state after a brief flash
      const timeout = setTimeout(() => {
        if ($wakeWord.get().status?.listening) {
          setWakeIndicatorState('listening')
        }
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [fired])
}
