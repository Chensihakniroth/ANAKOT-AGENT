/**
 * GatewayOfflineDialog — shown when the gateway cannot be reached.
 *
 * After the landing page is dismissed and the gateway fails to connect
 * within a timeout, this dialog informs visitors that the backend gateway
 * is not running and they should ask the admin to start it.
 *
 * Can be dismissed to still browse the settings/UI.
 */
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { $desktopBoot } from '@/store/boot'
import { $gatewayState } from '@/store/session'

// Time to wait before showing the offline dialog (ms).
// Matches the exponential backoff ceiling (15s) plus a buffer so the
// dialog doesn't appear before the final retry attempt fires.
const OFFLINE_TIMEOUT_MS = 30_000

export function GatewayOfflineDialog() {
  const gatewayState = useStore($gatewayState)
  const boot = useStore($desktopBoot)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Boot failed — BootFailureOverlay handles it
    if (boot.error) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return
    }

    // Gateway connected — no need for the dialog
    if (gatewayState === 'open') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setShow(false)
      return
    }

    // Gateway is still not open — start the timeout if not already running
    if (timeoutRef.current === null) {
      timeoutRef.current = setTimeout(() => {
        setShow(true)
      }, OFFLINE_TIMEOUT_MS)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [gatewayState, boot.error])

  // Reset timeout if dismissed and gateway state changes
  useEffect(() => {
    if (dismissed && gatewayState !== 'open' && !boot.error) {
      // Gateway still not open — re-show after another timeout
      timeoutRef.current = setTimeout(() => {
        setDismissed(false)
        setShow(true)
      }, OFFLINE_TIMEOUT_MS * 2)
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }
  }, [gatewayState, boot.error, dismissed])

  if (dismissed || !show || boot.error || gatewayState === 'open') return null

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0b2942] p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Icon */}
          <div className="flex size-14 items-center justify-center rounded-xl bg-[#ef5350]/15">
            <svg className="size-7 text-[#ef5350]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
            </svg>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-lg font-semibold text-[#d6deeb] m-0">
              Gateway Not Available
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#637777] m-0">
              {'The agent gateway could not be reached. ' +
               'The system will keep retrying in the background. ' +
               'Chat, sessions, and agent interaction require a running gateway.'}
            </p>
          </div>

          {/* Brand mark */}
          <BrandMark className="size-10 opacity-40" />

          {/* Actions */}
          <div className="flex w-full gap-3">
            <button
              onClick={() => {
                setDismissed(true)
                setShow(false)
              }}
              className="flex-1 cursor-pointer rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#d6deeb] transition-colors hover:bg-white/[0.08]"
            >
              Dismiss
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 cursor-pointer rounded-lg bg-[#82aaff] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6b96e0]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
