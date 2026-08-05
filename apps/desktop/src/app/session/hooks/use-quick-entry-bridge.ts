import { useEffect, useRef } from 'react'

import {
  initQuickEntryBridge,
  QUICK_TARGET_CURRENT,
  QUICK_TARGET_NEW,
  type QuickEntrySessionOption,
  setQuickEntrySubmitHandler
} from '@/store/quick-entry'
import { $gatewayState, $sessions } from '@/store/session'

interface QuickEntryBridgeParams {
  resumeSession: (sessionId: string, replaceRoute?: boolean) => Promise<unknown>
  startFreshSessionDraft: (focus?: boolean) => unknown
  submitText: (text: string) => Promise<unknown> | unknown
}

// The picker is a capture aid, not a session browser — a handful of recent
// rows is the whole point.
const QUICK_ENTRY_SESSION_OPTIONS = 5

function sessionOptions(): QuickEntrySessionOption[] {
  return $sessions
    .get()
    .filter(session => !session.archived)
    .slice(0, QUICK_ENTRY_SESSION_OPTIONS)
    .map(session => ({
      id: session.id,
      title: session.title?.trim() || session.preview?.trim() || session.id
    }))
}

/**
 * Wires the global-hotkey Quick Entry window back into the app, both ways:
 *
 * - **Inbound:** text captured there is routed by target and submitted through
 *   THIS window's normal prompt machinery — current chat rides `submitText`, a
 *   picked stored session rides `resumeSession` (background, without touching
 *   the primary view) then submits into the resumed session, and "new session"
 *   is a fresh draft + submit, exactly what clicking New Chat and typing does.
 *   One submit pipeline, no bespoke RPC.
 * - **Outbound:** gateway connection state + the recent-session list are pushed
 *   to the quick window (via main, which caches the latest push), so its input
 *   disables with a reconnect hint whenever the backend is unreachable.
 *
 * Handlers register ONCE through refs tracking the latest callbacks —
 * re-registering on identity churn leaves a nulled-handler window that can drop
 * a submit (the same bug shape use-pet-bridge guards).
 *
 * Ported from Hermes Agent (apps/desktop/src/app/contrib/hooks/use-quick-entry-bridge.ts).
 * Deviations from upstream, both because Anakot has no secondary-window
 * machinery: the `isSecondaryWindow()` early-return is dropped (the quick
 * window never mounts this controller, so there is no second claimer to guard
 * against), and a stored-session target uses the controller's `resumeSession`
 * instead of Hermes' `sessionTileDelegate().resumeTile()`.
 */
export function useQuickEntryBridge({ resumeSession, startFreshSessionDraft, submitText }: QuickEntryBridgeParams): void {
  const submitTextRef = useRef(submitText)
  submitTextRef.current = submitText
  const startFreshRef = useRef(startFreshSessionDraft)
  startFreshRef.current = startFreshSessionDraft
  const resumeRef = useRef(resumeSession)
  resumeRef.current = resumeSession

  useEffect(() => {
    setQuickEntrySubmitHandler(({ target, text }) => {
      if (target === QUICK_TARGET_NEW) {
        // Same as the user clicking New Chat and typing: fresh draft, then the
        // normal submit creates the backend session.
        startFreshRef.current()
        void submitTextRef.current(text)

        return
      }

      if (target !== QUICK_TARGET_CURRENT) {
        // A picked stored session: resume in the background so the primary view
        // stays where it is, then submit into the now-active session.
        void resumeRef
          .current(target)
          // A dead/undeliverable target must not swallow the prompt.
          .then(() => submitTextRef.current(text))
          .catch(() => void submitTextRef.current(text))

        return
      }

      void submitTextRef.current(text)
    })

    const dispose = initQuickEntryBridge()

    return () => {
      setQuickEntrySubmitHandler(null)
      dispose()
    }
  }, [])

  // Push gateway truth into the quick window whenever it changes: connection
  // state gates its input; the recent-session list feeds its target picker.
  useEffect(() => {
    const api = window.anakotDesktop?.quickEntry

    if (!api?.pushState) {
      return
    }

    const push = () => {
      api.pushState({ connected: $gatewayState.get() === 'open', sessions: sessionOptions() })
    }

    push()

    const offGateway = $gatewayState.listen(push)
    const offSessions = $sessions.listen(push)

    return () => {
      offGateway()
      offSessions()
    }
  }, [])
}
