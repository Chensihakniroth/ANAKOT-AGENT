import '@xterm/xterm/css/xterm.css'

import { useStore } from '@nanostores/react'
import { forwardRef, useImperativeHandle } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

import { SidebarPanelLabel } from '../../shell/sidebar-label'
import { $terminalTakeover, setRightSidebarTab, setTerminalTakeover } from '../store'

import { addSelectionShortcutLabel } from './selection'
import { useTerminalSession } from './use-terminal-session'

interface TerminalTabProps {
  cwd: string
  onAddSelectionToChat: (text: string, label?: string) => void
  shell?: 'powershell' | 'git-bash' | 'cmd'
}

export interface TerminalTabHandle {
  resize: () => void
}

export const TerminalTab = forwardRef<TerminalTabHandle, TerminalTabProps>(
  function TerminalTab({ cwd, onAddSelectionToChat, shell }, ref) {
    const { t } = useI18n()
    const { addSelectionToChat, hostRef, selection, selectionStyle, shellName, status } = useTerminalSession({
      cwd,
      onAddSelectionToChat,
      shell
    })

    const takeover = useStore($terminalTakeover)
    const label = takeover ? t.rightSidebar.terminalSplit : t.rightSidebar.terminalFocus

    const toggleTakeover = () => {
      if (takeover) {
        setRightSidebarTab('terminal')
      }
      setTerminalTakeover(!takeover)
    }

    useImperativeHandle(ref, () => ({
      resize: () => {
        window.dispatchEvent(new CustomEvent('terminal-resize'))
      },
    }))

    return (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-2 px-2.5">
          <SidebarPanelLabel className="text-white!">{shellName}</SidebarPanelLabel>
          <Tip label={label}>
            <Button
              aria-label={label}
              className="ml-auto size-6 rounded-md text-white!"
              onClick={toggleTakeover}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Codicon name={takeover ? 'screen-normal' : 'screen-full'} size="0.875rem" />
            </Button>
          </Tip>
        </div>
        <div className="relative h-full bg-[#002b36] p-2">
          {status === 'starting' && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <Loader
                className="size-8 text-(--ui-text-tertiary)"
                pathSteps={180}
                strokeScale={0.68}
                type="spiral-search"
              />
            </div>
          )}
          {selection.trim() && (
            <div className="absolute z-50 flex items-center gap-1" style={selectionStyle ?? { right: 12, top: 8 }}>
              <Button
                className="h-6 rounded-md px-2 text-[0.68rem] shadow-md backdrop-blur-md"
                onClick={event => event.preventDefault()}
                onMouseDown={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  addSelectionToChat()
                }}
                type="button"
                variant="secondary"
              >
                {t.rightSidebar.addToChat}
                <span className="ml-1 text-[0.6rem] text-(--ui-text-tertiary)">{addSelectionShortcutLabel()}</span>
              </Button>
            </div>
          )}
          <div
            className="absolute inset-0 overflow-hidden text-(--ui-text-secondary) [&_.xterm]:h-full [&_.xterm-screen]:h-full [&_.xterm-screen]:bg-[#002b36]! [&_.xterm-viewport]:h-full [&_.xterm-viewport]:bg-[#002b36]!"
            ref={hostRef}
          />
        </div>
      </div>
    )
  }
)
