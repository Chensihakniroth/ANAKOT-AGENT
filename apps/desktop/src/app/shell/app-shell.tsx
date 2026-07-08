import { useStore } from '@nanostores/react'
import { type CSSProperties, type ReactNode, useSyncExternalStore } from 'react'

import { NotificationStack } from '@/components/notifications'
import { PaneShell } from '@/components/pane-shell'
import { SidebarProvider } from '@/components/ui/sidebar'
import {
  $fileBrowserOpen,
  $panesFlipped,
  $sidebarOpen,
  FILE_BROWSER_DEFAULT_WIDTH,
  FILE_BROWSER_PANE_ID,
  setSidebarOpen
} from '@/store/layout'
import { $paneWidthOverride } from '@/store/panes'
import { $connection } from '@/store/session'

import { KeybindPanel } from './keybind-panel'
import { StatusbarControls, type StatusbarItem } from './statusbar-controls'
import { TITLEBAR_HEIGHT, titlebarControlsPosition } from './titlebar'
import { TitlebarControls, type TitlebarTool } from './titlebar-controls'
import { FloatingPet } from '@/components/pet/floating-pet'

interface AppShellProps {
  activityBar?: ReactNode
  children: ReactNode
  leftStatusbarItems?: readonly StatusbarItem[]
  leftTitlebarTools?: readonly TitlebarTool[]
  onOpenSettings: () => void
  overlays?: ReactNode
  statusbarItems?: readonly StatusbarItem[]
  titlebarTools?: readonly TitlebarTool[]
}

function subscribeWindowSize(cb: () => void) {
  window.addEventListener('resize', cb)
  window.addEventListener('fullscreenchange', cb)
  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('fullscreenchange', cb)
  }
}

const viewportIsFullscreen = () =>
  window.innerWidth >= window.screen.width && window.innerHeight >= window.screen.height

export function AppShell({
  activityBar,
  children,
  leftStatusbarItems,
  leftTitlebarTools,
  onOpenSettings,
  overlays,
  statusbarItems,
  titlebarTools
}: AppShellProps) {
  const sidebarOpen = useStore($sidebarOpen)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const panesFlipped = useStore($panesFlipped)
  const fileBrowserWidthOverride = useStore($paneWidthOverride(FILE_BROWSER_PANE_ID))
  const connection = useStore($connection)
  const viewportFullscreen = useSyncExternalStore(subscribeWindowSize, viewportIsFullscreen, () => false)
  const isFullscreen = Boolean(connection?.isFullscreen) || viewportFullscreen

  const titlebarControls = titlebarControlsPosition(connection?.windowButtonPosition, isFullscreen)
  const nativeOverlayWidth = connection?.nativeOverlayWidth ?? 0
  const titlebarToolsRight = nativeOverlayWidth > 0 ? `${nativeOverlayWidth}px` : '0.75rem'

  const leftEdgePaneOpen = panesFlipped ? fileBrowserOpen : sidebarOpen

  const titlebarContentInset = leftEdgePaneOpen
    ? 0
    : titlebarControls.left + TITLEBAR_HEIGHT + Math.round(TITLEBAR_HEIGHT / 2)

  const SYSTEM_TOOL_COUNT = 6 // sidebar + flip + haptics + keybinds + settings + right-sidebar
  const paneToolCount = titlebarTools?.filter(tool => !tool.hidden).length ?? 0
  const systemToolsWidth = `calc(${SYSTEM_TOOL_COUNT} * (var(--titlebar-control-size) + 0.25rem))`

  const fileBrowserWidth =
    fileBrowserWidthOverride !== undefined ? `${fileBrowserWidthOverride}px` : FILE_BROWSER_DEFAULT_WIDTH

  const previewToolbarGap = fileBrowserOpen ? fileBrowserWidth : systemToolsWidth

  const titlebarToolsWidth =
    paneToolCount > 0
      ? `calc(${previewToolbarGap} + ${paneToolCount} * (var(--titlebar-control-size) + 0.25rem))`
      : systemToolsWidth

  const activityBarWidth = activityBar ? 48 : 0

  return (
    <SidebarProvider
      className="h-screen min-h-0 flex-col bg-background"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={
        {
          '--sidebar-width': 'var(--pane-chat-sidebar-width)',
          '--titlebar-height': `${TITLEBAR_HEIGHT}px`,
          '--titlebar-content-inset': `${titlebarContentInset}px`,
          '--titlebar-controls-left': `${titlebarControls.left + activityBarWidth}px`,
          '--titlebar-controls-top': `${titlebarControls.top}px`,
          '--titlebar-tools-right': titlebarToolsRight,
          '--titlebar-tools-width': titlebarToolsWidth,
          '--shell-preview-toolbar-gap': previewToolbarGap
        } as CSSProperties
      }
    >
      <TitlebarControls leftTools={leftTitlebarTools} onOpenSettings={onOpenSettings} tools={titlebarTools} />

      <main
        className="relative z-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background transition-none"
      >
        {/* Content row: ActivityBar + PaneShell, offset below titlebar */}
        <div className="flex min-h-0 flex-1 flex-row" style={{ paddingTop: `var(--titlebar-height, ${TITLEBAR_HEIGHT}px)` }}>
          {/* Activity Bar — fixed width icon rail */}
          {activityBar && (
            <div className="relative z-10 shrink-0" style={{ width: `${activityBarWidth}px` }}>
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
      <FloatingPet />
    </SidebarProvider>
  )
}
