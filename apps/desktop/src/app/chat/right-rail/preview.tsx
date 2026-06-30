import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import type { SetTitlebarToolGroup } from '@/app/shell/titlebar-controls'
import { Codicon } from '@/components/ui/codicon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tip } from '@/components/ui/tooltip'
import { translateNow, useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  $rightRailActiveTabId,
  RIGHT_RAIL_PREVIEW_TAB_ID,
  type RightRailTabId,
  selectRightRailTab
} from '@/store/layout'
import {
  $filePreviewTabs,
  $previewReloadRequest,
  $previewTarget,
  closeRightRail,
  closeRightRailTab,
  type PreviewTarget
} from '@/store/preview'

import { PreviewPane } from './preview-pane'

export const PREVIEW_RAIL_MIN_WIDTH = '18rem'
export const PREVIEW_RAIL_MAX_WIDTH = '38rem'

const INTRINSIC = `clamp(${PREVIEW_RAIL_MIN_WIDTH}, 36vw, 32rem)`

// Track for <Pane id="preview">. Folds the intrinsic clamp with a min-floor
// against --chat-min-width so the chat surface never gets squeezed below it.
// Subtracts the project browser width so preview yields rather than crushing
// the chat when both right-side panes are open.
export const PREVIEW_RAIL_PANE_WIDTH = `min(${INTRINSIC}, max(0rem, calc(100vw - var(--pane-chat-sidebar-width) - var(--pane-file-browser-width, 0rem) - var(--chat-min-width))))`

interface ChatPreviewRailProps {
  onRestartServer?: (url: string, context?: string) => Promise<string>
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

interface RailTab {
  id: RightRailTabId
  label: string
  target: PreviewTarget
}

function tabLabelFor(target: PreviewTarget): string {
  const value = target.label || target.path || target.source || target.url
  const tail = value.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || value || translateNow('preview.tab')
}

export function ChatPreviewRail({ onRestartServer, setTitlebarToolGroup }: ChatPreviewRailProps) {
  const { t } = useI18n()
  const previewReloadRequest = useStore($previewReloadRequest)
  const activeTabId = useStore($rightRailActiveTabId)
  const filePreviewTabs = useStore($filePreviewTabs)
  const previewTarget = useStore($previewTarget)
  const [contextTabId, setContextTabId] = useState<string | null>(null)
  const [contextTabPath, setContextTabPath] = useState<string | null>(null)

  const tabs = useMemo<readonly RailTab[]>(
    () => [
      ...(previewTarget ? [{ id: RIGHT_RAIL_PREVIEW_TAB_ID, label: t.preview.tab, target: previewTarget } as RailTab] : []),
      ...filePreviewTabs.map(({ id, target }) => ({ id, label: tabLabelFor(target), target }) as RailTab)
    ],
    [filePreviewTabs, previewTarget, t.preview.tab]
  )

  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]

  useEffect(() => {
    if (activeTab && activeTab.id !== activeTabId) {
      selectRightRailTab(activeTab.id)
    }
  }, [activeTab, activeTabId])

  if (!activeTab) {
    return null
  }

  const isPreview = activeTab.id === RIGHT_RAIL_PREVIEW_TAB_ID

  return (
    <aside className="relative z-10 flex h-full w-full min-w-0 flex-col overflow-hidden border-l border-(--ui-stroke-tertiary) bg-(--ui-editor-surface-background) text-(--ui-text-tertiary)">
      <div className="group/rail-tabs flex h-(--titlebar-height) shrink-0 border-b border-(--ui-stroke-tertiary) bg-(--ui-sidebar-surface-background)">
        <div
          className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {tabs.map(tab => {
            const active = tab.id === activeTab.id
            const isFileTab = tab.id !== RIGHT_RAIL_PREVIEW_TAB_ID
            const tabPath = isFileTab ? (tab.target.path ?? null) : null

            return (
              <ContextMenu key={tab.id} onOpenChange={(open) => { if (!open && contextTabId === tab.id) { setContextTabId(null); setContextTabPath(null) } }}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      'group/tab relative flex h-full min-w-0 max-w-48 shrink-0 items-center text-[0.6875rem] font-medium [-webkit-app-region:no-drag] last:border-r last:border-(--ui-stroke-quaternary)',
                      active
                        ? 'bg-(--ui-editor-surface-background) text-foreground [--tab-bg:var(--ui-editor-surface-background)]'
                        : 'border-r border-(--ui-stroke-quaternary) text-(--ui-text-tertiary) [--tab-bg:var(--ui-sidebar-surface-background)] hover:bg-(--chrome-action-hover) hover:text-foreground'
                    )}
                    onAuxClick={event => {
                      if (event.button !== 1) return
                      event.preventDefault()
                      closeRightRailTab(tab.id)
                    }}
                    onMouseDown={event => {
                      if (event.button === 1) event.preventDefault()
                    }}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-(--ui-stroke-primary)" />
                    )}
                    <Tip label={tab.label}>
                      <button
                        aria-selected={active}
                        className="flex h-full min-w-0 max-w-full items-center overflow-hidden pl-3 pr-2 text-left outline-none"
                        onClick={() => selectRightRailTab(tab.id)}
                        role="tab"
                        type="button"
                      >
                        <span className="block min-w-0 truncate">{tab.label}</span>
                      </button>
                    </Tip>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-[linear-gradient(to_right,transparent,var(--tab-bg)_55%)] opacity-0 transition-opacity group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
                    />
                    <button
                            aria-label={t.preview.closeTab(tab.label)}
                            className="pointer-events-none absolute right-1.5 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-sm text-(--ui-text-tertiary) opacity-0 transition-[background-color,color,opacity] hover:bg-(--ui-bg-secondary) hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 group-focus-within/tab:pointer-events-auto group-focus-within/tab:opacity-100"
                            onClick={() => closeRightRailTab(tab.id)}
                            type="button"
                          >
                            <Codicon name="close" size="0.75rem" />
                          </button>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="min-w-[160px] rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) py-1 shadow-xl">
                        <ContextMenuItem
                          className="gap-2 px-3 py-1.5 text-xs"
                          onSelect={() => {
                            closeRightRailTab(tab.id)
                            setContextTabId(null)
                            setContextTabPath(null)
                          }}
                        >
                          <Codicon name="close" size="0.75rem" />
                          Close
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 px-3 py-1.5 text-xs"
                          disabled={tabs.length < 2}
                          onSelect={() => {
                            tabs.filter(t => t.id !== tab.id).forEach(t => closeRightRailTab(t.id))
                            setContextTabId(null)
                            setContextTabPath(null)
                          }}
                        >
                          <Codicon name="close" size="0.75rem" />
                          Close Others
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 px-3 py-1.5 text-xs"
                          disabled={tabs.findIndex(t => t.id === tab.id) === tabs.length - 1}
                          onSelect={() => {
                            const idx = tabs.findIndex(t => t.id === tab.id)
                            tabs.slice(idx + 1).forEach(t => closeRightRailTab(t.id))
                            setContextTabId(null)
                            setContextTabPath(null)
                          }}
                        >
                          <Codicon name="arrow-right" size="0.75rem" />
                          Close to Right
                        </ContextMenuItem>
                        <ContextMenuSeparator className="my-1 h-px bg-(--ui-stroke-tertiary)" />
                        <ContextMenuItem
                          className="gap-2 px-3 py-1.5 text-xs"
                          onSelect={() => {
                            tabs.forEach(t => closeRightRailTab(t.id))
                            setContextTabId(null)
                            setContextTabPath(null)
                          }}
                        >
                          <Codicon name="close" size="0.75rem" />
                          Close All
                        </ContextMenuItem>
                        {tabPath != null && (
                          <>
                            <ContextMenuSeparator className="my-1 h-px bg-(--ui-stroke-tertiary)" />
                            <ContextMenuItem
                              className="gap-2 px-3 py-1.5 text-xs"
                              onSelect={() => {
                                navigator.clipboard.writeText(tabPath).catch(() => undefined)
                                setContextTabId(null)
                                setContextTabPath(null)
                              }}
                            >
                              <Codicon name="copy" size="0.75rem" />
                              Copy Path
                            </ContextMenuItem>
                            <ContextMenuItem
                              className="gap-2 px-3 py-1.5 text-xs"
                              onSelect={() => {
                                // Open parent directory in system file manager
                                const parentDir = tabPath.split(/[\\/]/).slice(0, -1).join('/') || '/'
                                void window.anakotDesktop?.openExternal?.(`file://${parentDir}`)
                                setContextTabId(null)
                                setContextTabPath(null)
                              }}
                            >
                              <Codicon name="folder-opened" size="0.75rem" />
                              Reveal in Explorer
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
            )
          })}
        </div>
        <button
          aria-label={t.preview.closePane}
          className="mr-1.5 grid size-6 shrink-0 self-center place-items-center rounded-md text-(--ui-text-tertiary) opacity-0 transition-opacity hover:bg-(--ui-control-hover-background) hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-hover/rail-tabs:opacity-100 [-webkit-app-region:no-drag]"
          onClick={closeRightRail}
          type="button"
        >
          <Codicon name="close" size="0.75rem" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <PreviewPane
          embedded
          onRestartServer={isPreview ? onRestartServer : undefined}
          reloadRequest={previewReloadRequest}
          setTitlebarToolGroup={setTitlebarToolGroup}
          target={activeTab.target}
        />
      </div>
    </aside>
  )
}
