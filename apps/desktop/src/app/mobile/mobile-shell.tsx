'use client'

import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  AGENTS_ROUTE,
  ARTIFACTS_ROUTE,
  COMMAND_CENTER_ROUTE,
  CRON_ROUTE,
  MESSAGING_ROUTE,
  NOTEBOOK_ROUTE,
  PLUGINS_ROUTE,
  PROFILES_ROUTE,
  SETTINGS_ROUTE,
  SKILLS_ROUTE
} from '@/app/routes'
import { Codicon } from '@/components/ui/codicon'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarProvider } from '@/components/ui/sidebar'
import { sessionTitle } from '@/lib/chat-runtime'
import { setSidebarOpen } from '@/store/layout'
import { $selectedStoredSessionId, $sessions } from '@/store/session'

import { BottomNav, type MobileNavTab } from './bottom-nav'

interface MobileShellProps {
  children: ReactNode
  sessionList: ReactNode
  onNewSession: () => void
  onOpenSettings: () => void
}

// Feature routes that have no entry point on the mobile bottom bar. Grouped
// into sections so the drawer reads as a structured menu rather than a flat
// dump. Tapping one navigates to its existing overlay route (rendered by
// DesktopController's `overlays`), so nothing mobile-specific has to be
// rebuilt for each feature.
const MORE_SECTIONS: ReadonlyArray<{
  heading: string
  items: ReadonlyArray<{ label: string; icon: string; route: string }>
}> = [
  {
    heading: 'Workspace',
    items: [
      { label: 'Agents', icon: 'robot', route: AGENTS_ROUTE },
      { label: 'Cron', icon: 'clock', route: CRON_ROUTE },
      { label: 'Skills', icon: 'symbol-misc', route: SKILLS_ROUTE },
      { label: 'Command Center', icon: 'dashboard', route: COMMAND_CENTER_ROUTE },
      { label: 'Messaging', icon: 'comment', route: MESSAGING_ROUTE }
    ]
  },
  {
    heading: 'Configuration',
    items: [
      { label: 'Plugins', icon: 'extensions', route: PLUGINS_ROUTE },
      { label: 'Profiles', icon: 'organization', route: PROFILES_ROUTE },
      { label: 'Notebook', icon: 'book', route: NOTEBOOK_ROUTE },
      { label: 'Artifacts', icon: 'files', route: ARTIFACTS_ROUTE },
      { label: 'Settings', icon: 'gear', route: SETTINGS_ROUTE }
    ]
  }
]

const topBarButton =
  'flex size-10 items-center justify-center rounded-full text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-(--ui-text-primary)'

const drawerHeaderButton =
  'flex size-9 items-center justify-center rounded-full text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-(--ui-text-primary)'

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
  const [moreOpen, setMoreOpen] = useState(false)
  const [vvHeight, setVvHeight] = useState(0)

  const navigate = useNavigate()

  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)

  const activeStoredSession =
    sessions.find(s => s.id === selectedSessionId || s._lineage_root_id === selectedSessionId) || null

  const title = activeStoredSession ? sessionTitle(activeStoredSession) : 'New session'

  // The embedded ChatSidebar gates its content on the global $sidebarOpen
  // store, which is false on mobile. Force it open while the drawer is shown
  // so the session list actually renders.
  const openSessionsSheet = () => {
    setSidebarOpen(true)
    setMoreOpen(false)
    setSheetOpen(true)
  }

  const closeSessionsSheet = () => setSheetOpen(false)

  const openMoreSheet = () => {
    setSheetOpen(false)
    setMoreOpen(true)
  }

  const closeDrawers = () => {
    setSheetOpen(false)
    setMoreOpen(false)
  }

  const activeTab: MobileNavTab = moreOpen ? 'more' : sheetOpen ? 'sessions' : 'chat'

  // --- keyboard / visual viewport tracking --------------------------------
  const baselineRef = useRef(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport

    if (!vv) {
      return
    }

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
      {/* Mobile top app bar */}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background) px-2">
        <button
          aria-label="Open sessions"
          className={topBarButton}
          onClick={openSessionsSheet}
          type="button"
        >
          <Codicon name="list-tree" size="1.25rem" />
        </button>

        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[0.9375rem] font-semibold text-(--ui-text-primary)">{title}</h1>
        </div>

        <button
          aria-label="New session"
          className={topBarButton}
          onClick={onNewSession}
          type="button"
        >
          <Codicon name="add" size="1.25rem" />
        </button>
      </header>

      {/* Main content — fills remaining height */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>

      {/* Bottom navigation —present only when the keyboard is closed so the
          composer has room above the keyboard without visual overlap. */}
      {!keyboardOpen && (
        <BottomNav
          activeTab={activeTab}
          onChatClick={closeDrawers}
          onMoreClick={openMoreSheet}
          onSessionsClick={openSessionsSheet}
        />
      )}

      {/* Sessions list as a slide-out drawer. Wrapped in SidebarProvider so the
          embedded ChatSidebar (which calls useSidebar) has the context it
          requires — without this the drawer throws and blanks the screen. */}
      <Sheet onOpenChange={open => (open ? openSessionsSheet() : closeSessionsSheet())} open={sheetOpen}>
        <SheetContent className="flex w-[85vw] max-w-sm flex-col gap-0 p-0" showCloseButton={false} side="left">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-4">
            <h2 className="text-[0.9375rem] font-semibold text-(--ui-text-primary)">Sessions</h2>
            <div className="flex-1" />
            <button
              aria-label="Close"
              className={drawerHeaderButton}
              onClick={closeSessionsSheet}
              type="button"
            >
              <Codicon name="close" size="1.1rem" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">
            <SidebarProvider>{sessionList}</SidebarProvider>
          </div>
        </SheetContent>
      </Sheet>

      {/* "More" drawer — exposes feature routes that have no mobile entry point,
          grouped into sections so the list stays scannable. */}
      <Sheet onOpenChange={open => !open && setMoreOpen(false)} open={moreOpen}>
        <SheetContent className="flex w-[80vw] max-w-sm flex-col gap-0 p-0" showCloseButton={false} side="right">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-4">
            <h2 className="text-[0.9375rem] font-semibold text-(--ui-text-primary)">More</h2>
            <div className="flex-1" />
            <button
              aria-label="Close"
              className={drawerHeaderButton}
              onClick={() => setMoreOpen(false)}
              type="button"
            >
              <Codicon name="close" size="1.1rem" />
            </button>
          </header>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {MORE_SECTIONS.map((section, sectionIndex) => (
              <div
                className={sectionIndex > 0 ? 'border-t border-(--ui-stroke-tertiary)' : undefined}
                key={section.heading}
              >
                <div className="px-4 pb-1 pt-4 text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-tertiary)">
                  {section.heading}
                </div>
                {section.items.map(item => (
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--ui-control-hover-background)"
                    key={item.route}
                    onClick={() => {
                      setMoreOpen(false)
                      navigate(item.route)
                    }}
                    type="button"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--ui-bg-card) text-(--ui-text-secondary)">
                      <Codicon name={item.icon} size="1.1rem" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-(--ui-text-primary)">{item.label}</span>
                    <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="chevron-right" size="1rem" />
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
