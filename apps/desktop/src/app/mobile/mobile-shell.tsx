'use client'

import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Codicon } from '@/components/ui/codicon'
import { $activeSessionId, $selectedStoredSessionId, $sessions } from '@/store/session'
import { sessionTitle } from '@/lib/chat-runtime'

import { BottomNav } from './bottom-nav'

interface MobileShellProps {
  children: ReactNode
  sessionList: ReactNode
  onNewSession: () => void
  onOpenSettings: () => void
}

/**
 * On mobile the virtual keyboard resizes the visual viewport but does NOT
 * always shrink 100dvh (varies by browser/OS). This causes the composer
 * (position: absolute; bottom: 0) to sit behind the keyboard.
 *
 * Fix: listen for visualViewport resize and constrain the shell height to
 * the visible area when the keyboard is open. Also hide the BottomNav so
 * the composer has room above the keyboard.
 */
export function MobileShell({ children, sessionList, onNewSession, onOpenSettings }: MobileShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [vvHeight, setVvHeight] = useState(0)

  const activeSessionId = useStore($activeSessionId)
  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)

  const activeStoredSession =
    sessions.find(s => s.id === selectedSessionId || s._lineage_root_id === selectedSessionId) || null
  const title = activeStoredSession ? sessionTitle(activeStoredSession) : 'New session'

  // --- keyboard / visual viewport tracking --------------------------------
  //
  // The mobile virtual keyboard resizes `window.visualViewport` but does NOT
  // always shrink `100dvh` (varies by browser/OS).  Consequently the composer,
  // which is `position: absolute; bottom: 0`, sits behind the keyboard.
  //
  // Fix: track the live visual-viewport height via the `resize` event.
  // When the keyboard opens, constrain the outer container to that height and
  // hide the BottomNav so the composer stays visible above the keyboard.
  const baselineRef = useRef(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    baselineRef.current = vv.height
    setVvHeight(vv.height)

    const onResize = () => {
      const diff = baselineRef.current - vv.height
      setVvHeight(vv.height)
      if (diff > 100) {
        setKeyboardOpen(true)
      } else if (diff < 50) {
        baselineRef.current = vv.height
        setKeyboardOpen(false)
      }
    }

    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // When the keyboard is open, the outer container height matches the visual
  // viewport exactly.  The BottomNav is hidden so the composer (position:
  // absolute; bottom: 0 inside children) is right at the visible bottom.
  const shellHeight = keyboardOpen ? `${vvHeight}px` : '100dvh'

  // --- render --------------------------------------------------------------
  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: shellHeight, overflow: 'hidden', '--composer-width': '100%' } as React.CSSProperties}
    >
      {/* Mobile header bar */}
      <header
        className="flex shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background) px-3 h-12"
      >
        <button
          className="flex items-center justify-center size-9 rounded-md text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={() => setSheetOpen(true)}
          type="button"
          aria-label="Open sessions"
        >
          <Codicon name="list-tree" size="1.25rem" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium text-(--ui-text-primary)">{title}</h1>
        </div>

        <button
          className="flex items-center justify-center size-9 rounded-md text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={onNewSession}
          type="button"
          aria-label="New session"
        >
          <Codicon name="add" size="1.25rem" />
        </button>
      </header>

      {/* Main content — fills remaining height */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>

      {/* Bottom navigation — hidden when keyboard is open so the composer
          has room above the keyboard without visual overlap */}
      {!keyboardOpen && <BottomNav onSessionsClick={() => setSheetOpen(true)} onSettingsClick={onOpenSettings} />}

      {/* Sessions list as a slide-out drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="flex w-[80vw] max-w-sm flex-col p-0">
          <header className="flex shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-4 h-12">
            <h2 className="text-sm font-medium">Sessions</h2>
            <div className="flex-1" />
            <button
              className="flex items-center justify-center size-8 rounded-md text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-foreground"
              onClick={() => setSheetOpen(false)}
              type="button"
              aria-label="Close"
            >
              <Codicon name="close" size="1rem" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">{sessionList}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

