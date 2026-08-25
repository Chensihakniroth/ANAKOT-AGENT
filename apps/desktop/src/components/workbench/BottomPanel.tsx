import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { $bottomPanelTab, $bottomPanelOpen, setBottomPanelTab, setBottomPanelOpen, type BottomPanelTabId } from '@/store/workbench'
import { TerminalTab, type TerminalTabHandle } from '@/app/right-sidebar/terminal'
import { MultiTerminalPanel } from '@/app/right-sidebar/terminal/multi-terminal'
import { $currentCwd } from '@/store/session'
import { $gitLog } from '@/store/git-log'
import { GitOutputPanel } from './GitOutputPanel'
import { useEffect, useState, useCallback, useRef } from 'react'

// Slim default height + drag-to-collapse thresholds (VS Code-style bottom panel).
const SLIM_PANEL_HEIGHT = 200
const PANEL_MIN_HEIGHT = 80
const PANEL_MAX_HEIGHT = 600
// Dragging the open panel's top edge below this height collapses (closes) it.
// Kept equal to PANEL_MIN_HEIGHT so the panel visibly shrinks to this size and
// then snaps closed — there is no "dead zone" where it gets stuck open.
const PANEL_COLLAPSE_THRESHOLD = 80

import { $activeTerminalTab, updateTerminalTabShell } from '@/store/terminal-tabs'

type ShellType = 'powershell' | 'git-bash' | 'cmd'

const SHELL_OPTIONS: { id: ShellType; label: string; icon: string }[] = [
  { id: 'powershell', label: 'PowerShell', icon: 'terminal-powershell' },
  { id: 'git-bash', label: 'Git Bash', icon: 'terminal-bash' },
  { id: 'cmd', label: 'CMD', icon: 'terminal-cmd' },
]

interface BottomPanelProps {
  onAddSelectionToChat: (text: string, label?: string) => void
}

export function BottomPanel({ onAddSelectionToChat }: BottomPanelProps) {
  const activeTab = useStore($bottomPanelTab)
  const isOpen = useStore($bottomPanelOpen)
  const cwd = useStore($currentCwd)
  const activeTerminalTab = useStore($activeTerminalTab)
  const [selectedShell, setSelectedShell] = useState<ShellType>(
    (activeTerminalTab?.shell as ShellType) ?? 'powershell'
  )
  const [showShellPicker, setShowShellPicker] = useState(false)
  const [panelHeight, setPanelHeight] = useState(SLIM_PANEL_HEIGHT)
  const resizeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ y: number; height: number; opening: boolean; moved: boolean }>({ y: 0, height: 0, opening: false, moved: false })
  const terminalRef = useRef<TerminalTabHandle>(null)

  // Direct DOM resize during drag — bypasses React entirely for smooth 60fps resizing.
  // Only commits to React state on mouseup (so the rest of the UI sees the final size).
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync selectedShell when the active terminal tab changes (tab switch or shell update from elsewhere)
  useEffect(() => {
    if (activeTerminalTab?.shell) {
      setSelectedShell(activeTerminalTab.shell as ShellType)
    }
  }, [activeTerminalTab?.id, activeTerminalTab?.shell])

  // Unified drag handler for the panel edge. `opening` = dragging up from the
  // collapsed toggle bar (grow from 0); otherwise we resize the open panel and
  // collapse it if dragged below PANEL_COLLAPSE_THRESHOLD.
  const beginDrag = useCallback((e: React.MouseEvent, opening: boolean) => {
    e.preventDefault()
    isDraggingRef.current = true
    dragStartRef.current = { y: e.clientY, height: opening ? 0 : panelHeight, opening, moved: false }

    if (opening) {
      setBottomPanelOpen(true)
      setPanelHeight(0)
      if (panelRef.current) panelRef.current.style.height = '0px'
    }

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const { y, height, opening: isOpening } = dragStartRef.current
      const delta = y - ev.clientY // dragging up → positive
      if (Math.abs(delta) > 3) dragStartRef.current.moved = true
      let next = height + delta

      if (!isOpening && next <= PANEL_COLLAPSE_THRESHOLD) {
        // Collapse (close) the panel once dragged small enough.
        isDraggingRef.current = false
        setBottomPanelOpen(false)
        setPanelHeight(SLIM_PANEL_HEIGHT)
        if (panelRef.current) panelRef.current.style.height = '0px'
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        return
      }

      next = Math.max(isOpening ? 0 : PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, next))
      if (panelRef.current) panelRef.current.style.height = next + 'px'
    }

    const onUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!panelRef.current) return
      const finalH = parseInt(panelRef.current.style.height, 10)
      if (isNaN(finalH) || finalH <= 0) {
        // Click-to-open or a negligible drag → settle on the slim default.
        setPanelHeight(SLIM_PANEL_HEIGHT)
      } else {
        setPanelHeight(Math.max(PANEL_MIN_HEIGHT, finalH))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelHeight])

  const panel = (
    <div
      ref={panelRef}
      className="shrink-0 flex flex-col"
      style={{
        height: isOpen ? panelHeight + 'px' : '0px',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Resize handle — slim 1px hairline (4px grab area), no thick border */}
      <div
        ref={resizeRef}
        className="group relative cursor-ns-resize"
        style={{ height: '4px', flexShrink: 0 }}
        onMouseDown={e => beginDrag(e, false)}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-(--ui-stroke-secondary) opacity-30 transition-opacity group-hover:opacity-70" />
      </div>

      {/* Tab bar — seamless, no border / no fill so it doesn't read as a thick divider */}
      <div className="flex items-center justify-between bg-transparent px-1.5" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-0.5">
          {BOTTOM_TABS.map(tab => {
            const logCount = tab.id === 'output' ? $gitLog.get().length : 0
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-1 rounded-sm px-2 py-0.5 text-[0.65rem] transition-colors ${activeTab === tab.id ? 'bg-(--ui-tab-active-background) text-foreground' : 'text-muted-foreground hover:text-(--ui-text-secondary)'}`}
                onClick={() => setBottomPanelTab(tab.id)}
                type="button"
              >
                <Codicon name={tab.icon} size="0.75rem" />
                {tab.label}
                {tab.id === 'output' && logCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 text-[0.55rem] text-primary">
                    {logCount > 99 ? '99+' : logCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1">
          {activeTab === 'terminal' && (
            <button
              className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.6rem] text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
              onClick={() => terminalRef.current?.clear()}
              title="Clear terminal"
              type="button"
            >
              <Codicon name="trash" size="0.7rem" />
              Clear
            </button>
          )}
          {activeTab === 'terminal' && (
            <div className="relative">
              <button
                className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.6rem] text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                onClick={() => setShowShellPicker(!showShellPicker)}
                title="Select Shell"
                type="button"
              >
                <Codicon name="terminal" size="0.7rem" />
                {SHELL_OPTIONS.find(s => s.id === selectedShell)?.label || 'Shell'}
                <Codicon name="chevron-down" size="0.6rem" />
              </button>
              {showShellPicker && (
                <div className="absolute top-full right-0 z-50 mt-1 min-w-[120px] rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) py-1 shadow-lg">
                  {SHELL_OPTIONS.map(shell => (
                    <button
                      key={shell.id}
                      className={`flex w-full items-center gap-2 px-2 py-1 text-[0.65rem] transition-colors hover:bg-(--ui-control-hover-background) ${selectedShell === shell.id ? 'text-foreground' : 'text-muted-foreground'}`}
                      onClick={() => {
                        if (activeTerminalTab) {
                          updateTerminalTabShell(activeTerminalTab.id, shell.id)
                        }
                        setSelectedShell(shell.id)
                        setShowShellPicker(false)
                      }}
                      type="button"
                    >
                      <Codicon name={shell.icon} size="0.7rem" />
                      {shell.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
            onClick={() => setBottomPanelOpen(false)}
            type="button"
          >
            <Codicon name="chevron-down" size="0.75rem" />
          </button>
        </div>
      </div>

      {/* Panel content — always mount all tabs so TerminalTab stays alive */}
      <div ref={contentRef} className="relative flex flex-1 flex-col overflow-hidden" style={{ minHeight: 0, minWidth: 0 }}>
        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', width: '100%', height: '100%' }}>
          <MultiTerminalPanel cwd={cwd} onAddSelectionToChat={onAddSelectionToChat} terminalRef={terminalRef} />
        </div>
        <div style={{ display: activeTab === 'output' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>
          <GitOutputPanel />
        </div>
        <div style={{ display: activeTab === 'problems' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', width: '100%' }}>
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Problems panel
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Always-mounted panel (0 height when collapsed, full when open) */}
      {panel}
      {/* Toggle bar — overlaid on top when collapsed, shown below panel when open */}
      {!isOpen && (
        <div
          className="h-1.5 shrink-0 cursor-ns-resize"
          onMouseDown={e => beginDrag(e, true)}
          title="Drag up to open panel"
        />
      )}
    </>
  )
}

const BOTTOM_TABS: { id: BottomPanelTabId; icon: string; label: string }[] = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
  { id: 'output', icon: 'output', label: 'Output' },
  { id: 'problems', icon: 'warning', label: 'Problems' },
]
