import { useStore } from '@nanostores/react'
import { useState, type ReactNode } from 'react'

import { NotificationStack } from '@/components/notifications'
import { PaneShell } from '@/components/pane-shell'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useVisualViewport } from '@/hooks/use-visual-viewport'
import { PanelLeftIcon } from '@/lib/icons'
import { $sidebarOpen, setSidebarOpen, toggleSidebarOpen } from '@/store/layout'
import { $connection } from '@/store/session'

import { KeybindPanel } from './keybind-panel'
import { StatusbarControls, type StatusbarItem } from './statusbar-controls'

interface AppShellProps {
  activityBar?: ReactNode
  children: ReactNode
  leftStatusbarItems?: readonly StatusbarItem[]
  onOpenSettings: () => void
  overlays?: ReactNode
  /** Content for the mobile sidebar drawer (session list, etc.) */
  sidebarContent?: ReactNode
  statusbarItems?: readonly StatusbarItem[]
}

export function AppShell({
  activityBar,
  children,
  leftStatusbarItems,
  onOpenSettings,
  overlays,
  sidebarContent,
  statusbarItems
}: AppShellProps) {
  const sidebarOpen = useStore($sidebarOpen)
  const connection = useStore($connection)

  const { vvHeight, keyboardOpen } = useVisualViewport()
  const isMobile = useIsMobile()
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  // When the mobile keyboard opens, constrain the app to the visible viewport
  // height.  The composer is `position: absolute; bottom: 0` and mobile
  // browsers don't shrink `100dvh` / `100vh` when the keyboard appears, so
  // the composer would hide behind the keyboard.
  const shellHeight = keyboardOpen && vvHeight !== null ? `${vvHeight}px` : undefined

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileSheetOpen(true)
    } else {
      toggleSidebarOpen()
    }
  }

  return (
    <SidebarProvider
      className="h-screen min-h-0 flex-col bg-background"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={shellHeight ? { height: shellHeight } : undefined}
    >
      <main
        className="relative z-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background transition-none"
      >
        {/* Content row: ActivityBar + PaneShell */}
        <div className="flex min-h-0 flex-1 flex-row">
          {/* Activity Bar — fixed width icon rail */}
          {activityBar && (
            <div className="appshell-activitybar relative z-10 shrink-0" style={{ width: '48px' }}>
              {activityBar}
            </div>
          )}

          {/* PaneShell — takes remaining width */}
          <div className="min-w-0 flex-1">
            <PaneShell className="min-h-0 flex-1">
              {children}
            </PaneShell>
          </div>
        </div>

        {/* Status bar at bottom */}
        <StatusbarControls items={statusbarItems} leftItems={leftStatusbarItems} />
      </main>

      {overlays}

      <KeybindPanel />

      {/* Mobile floating sidebar toggle — hidden when keyboard is open so it
          doesn't overlap the chat composer (bottom-left corner). On mobile,
          opens a Sheet drawer with the session list instead of toggling the
          desktop pane (which is hidden by CSS at the mobile breakpoint). */}
      <button
        aria-label="Toggle sidebar"
        className="mobile-sidebar-toggle"
        onClick={handleToggleSidebar}
        style={{ display: keyboardOpen ? 'none' : undefined }}
        type="button"
      >
        <PanelLeftIcon />
      </button>

      {/* Mobile sidebar Sheet — slide-out drawer from the left containing the
          session list. Only renders on mobile; on desktop the sidebar is part
          of the PaneShell grid layout. */}
      {isMobile && (
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent
            side="left"
            className="flex w-[80vw] max-w-sm flex-col p-0"
            showCloseButton={false}
          >
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      <NotificationStack />
    </SidebarProvider>
  )
}
