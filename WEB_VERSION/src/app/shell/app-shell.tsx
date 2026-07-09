import { useStore } from '@nanostores/react'
import { type ReactNode } from 'react'

import { NotificationStack } from '@/components/notifications'
import { PaneShell } from '@/components/pane-shell'
import { SidebarProvider } from '@/components/ui/sidebar'
import { $sidebarOpen, setSidebarOpen } from '@/store/layout'
import { $connection } from '@/store/session'

import { KeybindPanel } from './keybind-panel'
import { StatusbarControls, type StatusbarItem } from './statusbar-controls'

interface AppShellProps {
  activityBar?: ReactNode
  children: ReactNode
  leftStatusbarItems?: readonly StatusbarItem[]
  onOpenSettings: () => void
  overlays?: ReactNode
  statusbarItems?: readonly StatusbarItem[]
}

export function AppShell({
  activityBar,
  children,
  leftStatusbarItems,
  onOpenSettings,
  overlays,
  statusbarItems
}: AppShellProps) {
  const sidebarOpen = useStore($sidebarOpen)
  const connection = useStore($connection)

  return (
    <SidebarProvider
      className="h-screen min-h-0 flex-col bg-background"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
    >
      <main
        className="relative z-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background transition-none"
      >
        {/* Content row: ActivityBar + PaneShell */}
        <div className="flex min-h-0 flex-1 flex-row">
          {/* Activity Bar — fixed width icon rail */}
          {activityBar && (
            <div className="relative z-10 shrink-0" style={{ width: '48px' }}>
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

      <NotificationStack />
    </SidebarProvider>
  )
}
