import { useStore } from '@nanostores/react'
import { type Ref, useRef } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { LazyTerminalTab as TerminalTab, type TerminalTabHandle } from './lazy-terminal'
import {
  $activeTerminalTabId,
  $terminalTabs,
  addTerminalTab,
  closeTerminalTab,
  setActiveTerminalTab,
  updateTerminalTabShell,
  type TerminalTabInfo
} from '@/store/terminal-tabs'

interface MultiTerminalPanelProps {
  cwd: string
  onAddSelectionToChat: (text: string, label?: string) => void
  terminalRef?: Ref<TerminalTabHandle>
}

export function MultiTerminalPanel({ cwd, onAddSelectionToChat, terminalRef }: MultiTerminalPanelProps) {
  const tabs = useStore($terminalTabs)
  const activeId = useStore($activeTerminalTabId)

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <TerminalTabBar
        activeId={activeId}
        onAdd={() => addTerminalTab()}
        onClose={id => closeTerminalTab(id)}
        onSelect={id => setActiveTerminalTab(id)}
        tabs={tabs}
      />
      <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="absolute inset-0 flex flex-col min-h-0 min-w-0"
            style={{ display: tab.id === activeId ? 'flex' : 'none' }}
          >
            <TerminalTab
              ref={tab.id === activeId ? terminalRef as any : undefined}
              cwd={cwd}
              onAddSelectionToChat={onAddSelectionToChat}
              shell={tab.shell}
            />
          </div>  
        ))}
      </div>
    </div>
  )
}

interface TerminalTabBarProps {
  activeId: string
  onAdd: () => void
  onClose: (id: string) => void
  onSelect: (id: string) => void
  tabs: TerminalTabInfo[]
}

function TerminalTabBar({ activeId, onAdd, onClose, onSelect, tabs }: TerminalTabBarProps) {
  return (
    <div
      className="flex shrink-0 items-center border-b border-(--ui-stroke-secondary) bg-(--ui-tab-inactive-background) pr-1"
      style={{ minHeight: 28 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-px overflow-x-auto">
        {tabs.map(tab => (
          <TerminalTabButton
            key={tab.id}
            active={tab.id === activeId}
            label={tab.label}
            onClose={() => onClose(tab.id)}
            onSelect={() => onSelect(tab.id)}
            showClose={tabs.length > 1}
          />
        ))}
      </div>
      <Tip label="New Terminal" side="bottom">
        <button
          aria-label="New Terminal"
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={onAdd}
          type="button"
        >
          <Codicon name="add" size="0.75rem" />
        </button>
      </Tip>
    </div>
  )
}

interface TerminalTabButtonProps {
  active: boolean
  label: string
  onClose: () => void
  onSelect: () => void
  showClose?: boolean
}

function TerminalTabButton({ active, label, onClose, onSelect, showClose = true }: TerminalTabButtonProps) {
  return (
    <div
      className={cn(
        'group flex shrink-0 cursor-pointer items-center gap-1 px-2 py-1 text-[0.68rem] transition-colors',
        active
          ? 'bg-(--ui-tab-active-background) text-foreground'
          : 'text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground'
      )}
      onClick={onSelect}
      role="tab"
      aria-selected={active}
    >
      <Codicon name="terminal" size="0.65rem" />{showClose && (
        <button
          className="ml-0.5 flex size-3.5 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--ui-control-hover-background)"
          onClick={e => {
            e.stopPropagation()
            onClose()
          }}
          type="button"
          aria-label={`Close ${label}`}
        >
          <Codicon name="close" size="0.55rem" />
        </button>
      )}
    </div>
  )
}
