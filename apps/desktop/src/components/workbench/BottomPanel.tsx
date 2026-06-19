import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $bottomPanelTab, $bottomPanelOpen, setBottomPanelTab, setBottomPanelOpen, type BottomPanelTabId } from '@/store/workbench'
import { TerminalTab } from '@/app/right-sidebar/terminal'
import { $currentCwd } from '@/store/session'

interface BottomPanelProps {
  onAddSelectionToChat: (text: string, label?: string) => void
}

const BOTTOM_TABS = [
  { id: 'terminal' as const, icon: 'terminal', label: 'Terminal' },
  { id: 'output' as const, icon: 'output', label: 'Output' },
  { id: 'problems' as const, icon: 'warning', label: 'Problems' },
]

export function BottomPanel({ onAddSelectionToChat }: BottomPanelProps) {
  const activeTab = useStore($bottomPanelTab)
  const isOpen = useStore($bottomPanelOpen)
  const cwd = useStore($currentCwd)

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
    <div className="flex h-48 shrink-0 flex-col border-t border-(--ui-stroke-secondary)">
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
        <button
          className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={() => setBottomPanelOpen(false)}
          type="button"
        >
          <Codicon name="chevron-down" size="0.75rem" />
        </button>
      </div>

      {/* Panel content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === 'terminal' && (
          <TerminalTab cwd={cwd} onAddSelectionToChat={onAddSelectionToChat} />
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
