import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $bottomPanelTab, $bottomPanelOpen, setBottomPanelTab, setBottomPanelOpen, type BottomPanelTabId } from '@/store/workbench'
import { TerminalTab, type TerminalTabHandle } from '@/app/right-sidebar/terminal'
import { $currentCwd } from '@/store/session'
import { useState, useCallback, useRef } from 'react'

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
  const [selectedShell, setSelectedShell] = useState<ShellType>('powershell')
  const [showShellPicker, setShowShellPicker] = useState(false)
  const [panelHeight, setPanelHeight] = useState(300)
  const resizeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const terminalRef = useRef<TerminalTabHandle>(null)

  // Direct DOM resize during drag — bypasses React entirely for smooth 60fps resizing.
  // Only commits to React state on mouseup (so the rest of the UI sees the final size).
  const panelRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    const startY = e.clientY
    const startHeight = panelHeight

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = startY - e.clientY
      const newHeight = Math.max(120, Math.min(600, startHeight + delta))
      // Direct DOM update — no React re-render during drag
      if (panelRef.current) {
        panelRef.current.style.height = newHeight + 'px'
      }
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      // Commit final height to React state
      if (panelRef.current) {
        const finalHeight = parseInt(panelRef.current.style.height, 10)
        if (!isNaN(finalHeight)) {
          setPanelHeight(finalHeight)
        }
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelHeight])

  const panel = (
    <div
      ref={panelRef}
      className="shrink-0 grid border-t border-(--ui-stroke-secondary)"
      style={{
        height: isOpen ? panelHeight + 'px' : '0px',
        gridTemplateRows: isOpen ? '4px 28px 1fr' : '0px',
        overflow: 'hidden',
      }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="cursor-ns-resize bg-transparent hover:bg-(--ui-stroke-secondary) active:bg-primary/30 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-(--ui-stroke-secondary) bg-(--ui-tab-inactive-background) px-2">
        <div className="flex items-center gap-0.5">
          {BOTTOM_TABS.map(tab => (
            <button
              key={tab.id}
              className={cn(
                'flex items-center gap-1 rounded-sm px-2 py-0.5 text-[0.65rem] transition-colors',
                activeTab === tab.id
                  ? 'bg-(--ui-tab-active-background) text-foreground'
                  : 'text-muted-foreground hover:text-(--ui-text-secondary)'
              )}
              onClick={() => setBottomPanelTab(tab.id)}
              type="button"
            >
              <Codicon name={tab.icon} size="0.75rem" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
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
                <div className="absolute bottom-full right-0 z-50 mb-1 min-w-[120px] rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) py-1 shadow-lg">
                  {SHELL_OPTIONS.map(shell => (
                    <button
                      key={shell.id}
                      className={cn(
                        'flex w-full items-center gap-2 px-2 py-1 text-[0.65rem] transition-colors hover:bg-(--ui-control-hover-background)',
                        selectedShell === shell.id ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      onClick={() => {
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
      <div ref={contentRef} className="relative overflow-hidden" style={{ width: '100%', minWidth: 0 }}>
        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, height: '100%', width: '100%' }}>
          <TerminalTab cwd={cwd} onAddSelectionToChat={onAddSelectionToChat} shell={selectedShell} />
        </div>
        <div style={{ display: activeTab === 'output' ? 'flex' : 'none', height: '100%' }}>
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Output panel
          </div>
        </div>
        <div style={{ display: activeTab === 'problems' ? 'flex' : 'none', height: '100%' }}>
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
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
        <div className="flex h-7 shrink-0 items-center justify-end border-t border-(--ui-stroke-secondary) bg-(--ui-statusbar-background) px-2">
          <button
            className="flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
            onClick={() => setBottomPanelOpen(true)}
            type="button"
          >
            <Codicon name="chevron-up" size="0.75rem" />
            Panel
          </button>
        </div>
      )}
    </>
  )
}

const BOTTOM_TABS: { id: BottomPanelTabId; icon: string; label: string }[] = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
  { id: 'output', icon: 'output', label: 'Output' },
  { id: 'problems', icon: 'warning', label: 'Problems' },
]
