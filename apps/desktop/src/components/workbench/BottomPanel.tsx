import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $bottomPanelTab, $bottomPanelOpen, setBottomPanelTab, setBottomPanelOpen, type BottomPanelTabId } from '@/store/workbench'
import { TerminalTab } from '@/app/right-sidebar/terminal'
import { $currentCwd } from '@/store/session'
import { useState, useCallback, useRef, type ReactNode } from 'react'

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
  const [panelHeight, setPanelHeight] = useState(200)
  const resizeRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    const startY = e.clientY
    const startHeight = panelHeight

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = startY - e.clientY
      const newHeight = Math.max(120, Math.min(600, startHeight + delta))
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelHeight])

  if (!isOpen) {
    return (
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
    )
  }

  return (
    <div
      className="shrink-0 flex-col border-t border-(--ui-stroke-secondary)"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="h-1 shrink-0 cursor-ns-resize bg-transparent hover:bg-(--ui-stroke-secondary) active:bg-primary/30 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* Tab bar */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-(--ui-stroke-secondary) bg-(--ui-tab-inactive-background) px-2">
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

      {/* Panel content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === 'terminal' && (
          <TerminalTab cwd={cwd} onAddSelectionToChat={onAddSelectionToChat} shell={selectedShell} />
        )}
        {activeTab === 'output' && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Output panel
          </div>
        )}
        {activeTab === 'problems' && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Problems panel
          </div>
        )}
      </div>
    </div>
  )
}

const BOTTOM_TABS: { id: BottomPanelTabId; icon: string; label: string }[] = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
  { id: 'output', icon: 'output', label: 'Output' },
  { id: 'problems', icon: 'warning', label: 'Problems' },
]
