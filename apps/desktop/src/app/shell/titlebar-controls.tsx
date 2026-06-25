import { useStore } from '@nanostores/react'
import type { ComponentProps, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { $hapticsMuted, toggleHapticsMuted } from '@/store/haptics'
import { toggleKeybindPanel } from '@/store/keybinds'
import {
  $fileBrowserOpen,
  $panesFlipped,
  $rightRailCollapsed,
  togglePanesFlipped
} from '@/store/layout'
import { $previewTarget, $filePreviewTarget } from '@/store/preview'

import { appViewForPath, isOverlayView } from '../routes'

import { titlebarButtonClass } from './titlebar'

export interface TitlebarTool {
  id: string
  label: string
  active?: boolean
  className?: string
  disabled?: boolean
  hidden?: boolean
  href?: string
  icon: ReactNode
  onSelect?: () => void
  title?: string
  to?: string
}

export type TitlebarToolSide = 'left' | 'right'
export type SetTitlebarToolGroup = (id: string, tools: readonly TitlebarTool[], side?: TitlebarToolSide) => void

interface TitlebarControlsProps extends ComponentProps<'div'> {
  leftTools?: readonly TitlebarTool[]
  tools?: readonly TitlebarTool[]
  onOpenSettings: () => void
}

export function TitlebarControls({ leftTools = [], tools = [], onOpenSettings }: TitlebarControlsProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const hapticsMuted = useStore($hapticsMuted)
  const panesFlipped = useStore($panesFlipped)
  const filePreviewTarget = useStore($filePreviewTarget)
  const rightRailCollapsed = useStore($rightRailCollapsed)

  const toggleHaptics = () => {
    if (!hapticsMuted) {
      triggerHaptic('tap')
    }

    toggleHapticsMuted()

    if (hapticsMuted) {
      window.requestAnimationFrame(() => triggerHaptic('success'))
    }
  }

  // Right rail visibility: collapsed flag OR (no file-browser AND no preview)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const previewTarget = useStore($previewTarget)
  const rightRailHasContent = fileBrowserOpen || previewTarget || filePreviewTarget
  const rightRailVisible = !rightRailCollapsed && rightRailHasContent

  // All utility tools grouped on the left side (macOS-style).
  // Only window controls (minimize, maximize, close) stay on the far right.
  const leftToolbarTools: TitlebarTool[] = [
    {
      icon: <Codicon name="arrow-swap" />,
      id: 'flip-panes',
      label: t.titlebar.swapSidebarSides,
      onSelect: () => {
        triggerHaptic('tap')
        togglePanesFlipped()
      },
      title: t.titlebar.swapSidebarSidesTitle
    },
    ...leftTools,
    {
      active: hapticsMuted,
      icon: <Codicon name={hapticsMuted ? 'mute' : 'unmute'} />,
      id: 'haptics',
      label: hapticsMuted ? t.titlebar.unmuteHaptics : t.titlebar.muteHaptics,
      onSelect: toggleHaptics
    },
    {
      icon: <Codicon name="keyboard" />,
      id: 'keybinds',
      label: t.titlebar.openKeybinds,
      onSelect: () => {
        triggerHaptic('open')
        toggleKeybindPanel()
      }
    }
  ]

  // While a full-screen overlay (settings, command center, …) is open it should
  // visually own the window. These control clusters are `fixed` at a higher
  // z-index than the overlay card, so they'd otherwise bleed over it — hide them
  // and let the overlay's own chrome (close button, drag region) take over.
  if (isOverlayView(appViewForPath(location.pathname))) {
    return null
  }

  const visiblePaneTools = tools.filter(tool => !tool.hidden)

  return (
    <>
      {/* Draggable titlebar background — sits behind buttons (z-60 vs z-70).
          Buttons use [-webkit-app-region:no-drag] to opt out of dragging. */}
      <div
        className="fixed left-0 right-0 top-0 z-60 h-(--titlebar-height) [-webkit-app-region:drag]"
        style={{ pointerEvents: 'auto' }}
      />

      {/* All utility tools — grouped on the left (macOS-style), packed tight */}
      <div
        aria-label={t.shell.windowControls}
        className="fixed left-(--titlebar-controls-left) top-(--titlebar-controls-top) z-70 flex translate-y-0.5 flex-row items-center gap-x-0.5 pointer-events-auto select-none [-webkit-app-region:no-drag]"
      >
        {leftToolbarTools
          .filter(tool => !tool.hidden)
          .map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
      </div>

      {/*
        Pane-scoped tools (preview's monitor / devtools / refresh / X) render
        as their own fixed cluster. AppShell sets --shell-preview-toolbar-gap
        to either the static cluster's width (file-browser closed → cluster
        sits flush against system tools) or the file-browser pane's width
        (file-browser open → cluster sits flush against the file-browser pane,
        i.e. at the preview pane's right edge). No margin hacks needed.
      */}
      {visiblePaneTools.length > 0 && (
        <div
          aria-label={t.shell.paneControls}
          className="fixed top-(--titlebar-controls-top) right-[calc(var(--titlebar-tools-right)+var(--shell-preview-toolbar-gap,0))] z-70 flex flex-row items-center gap-x-1 pointer-events-auto select-none [-webkit-app-region:no-drag]"
        >
          {visiblePaneTools.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
        </div>
      )}
    </>
  )
}

function TitlebarToolButton({ navigate, tool }: { navigate: ReturnType<typeof useNavigate>; tool: TitlebarTool }) {
  // Titlebar actions never show an active background — state reads from the
  // icon itself (e.g. the mute/unmute glyph). aria-pressed still carries it
  // for a11y.
  const className = cn(titlebarButtonClass, 'bg-transparent select-none', tool.className)

  if (tool.href) {
    return (
      <Button asChild className={className} size="icon-titlebar" variant="ghost">
        <a
          aria-label={tool.label}
          href={tool.href}
          onPointerDown={event => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
          title={tool.title ?? tool.label}
        >
          {tool.icon}
        </a>
      </Button>
    )
  }

  return (
    <Button
      aria-label={tool.label}
      aria-pressed={tool.active ?? undefined}
      className={className}
      disabled={tool.disabled}
      onClick={() => {
        if (tool.to) {
          navigate(tool.to)
        }

        tool.onSelect?.()
      }}
      onPointerDown={event => event.stopPropagation()}
      size="icon-titlebar"
      title={tool.title ?? tool.label}
      type="button"
      variant="ghost"
    >
      {tool.icon}
    </Button>
  )
}
