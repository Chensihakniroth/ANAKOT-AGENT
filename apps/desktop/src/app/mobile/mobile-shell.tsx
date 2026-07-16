'use client'

import { useStore } from '@nanostores/react'
import { useState, type ReactNode } from 'react'

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

export function MobileShell({ children, sessionList, onNewSession, onOpenSettings }: MobileShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeSessionId = useStore($activeSessionId)
  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)

  const activeStoredSession =
    sessions.find(s => s.id === selectedSessionId || s._lineage_root_id === selectedSessionId) || null
  const title = activeStoredSession ? sessionTitle(activeStoredSession) : 'New session'

  return (
    <div
      className="flex h-dvh flex-col bg-background"
      style={{ '--composer-width': '100%' } as React.CSSProperties}
    >
      {/* Mobile header bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background) px-3 h-12">
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
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      {/* Bottom navigation */}
      <BottomNav onSessionsClick={() => setSheetOpen(true)} onSettingsClick={onOpenSettings} />

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
