'use client'

import { useEffect, useState } from 'react'

import type { WakeIndicatorState } from '@/lib/wake-indicator'
import { getWakeIndicatorState, onWakeIndicatorState } from '@/lib/wake-indicator'

export function WakeIndicatorApp() {
  const [state, setState] = useState<WakeIndicatorState>('hidden')

  useEffect(() => {
    let mounted = true
    let receivedLiveState = false

    const unsubscribe = onWakeIndicatorState(next => {
      if (mounted) {
        receivedLiveState = true
        setState(next)
      }
    })

    void getWakeIndicatorState()
      .then(result => {
        if (mounted && !receivedLiveState && result.ok) {
          setState(result.state as WakeIndicatorState)
        }
      })
      .catch(() => undefined)

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [])

  return (
    <main aria-hidden className="wake-indicator-surface flex h-screen w-screen items-center justify-center" data-state={state}>
      <div
        className="wake-indicator-light h-3 w-3 rounded-full transition-all duration-300"
        style={{
          opacity: state === 'hidden' ? 0 : 1,
          backgroundColor:
            state === 'detected' ? '#22c55e' :
            state === 'processing' ? '#eab308' :
            state === 'listening' ? '#3b82f6' : '#374151',
          transform: state === 'detected' ? 'scale(1.5)' : 'scale(1)',
          boxShadow: state === 'detected' ? '0 0 20px #22c55e' : 'none',
        }}
      />
    </main>
  )
}
