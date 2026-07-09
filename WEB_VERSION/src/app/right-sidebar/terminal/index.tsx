import '@xterm/xterm/css/xterm.css'

import { forwardRef, useImperativeHandle } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'

import { addSelectionShortcutLabel } from './selection'
import { useTerminalSession } from './use-terminal-session'

interface TerminalTabProps {
  cwd: string
  onAddSelectionToChat: (text: string, label?: string) => void
  shell?: 'powershell' | 'git-bash' | 'cmd'
}

export interface TerminalTabHandle {
  resize: () => void
  clear: () => void
}

export const TerminalTab = forwardRef<TerminalTabHandle, TerminalTabProps>(
function TerminalTabInner({ cwd, onAddSelectionToChat, shell }, ref) {
  const { t } = useI18n()
  const { addSelectionToChat, clear: clearTerminal, hostRef, selection, selectionStyle, shellName, status } = useTerminalSession({
    cwd,
    onAddSelectionToChat,
    shell
  })

  // Expose resize and clear methods to parent
  useImperativeHandle(ref, () => ({
    resize: () => {
      window.dispatchEvent(new CustomEvent('terminal-resize'))
    },
    clear: () => {
      clearTerminal()
    },
  }))

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
      {/* Terminal container: width: 100% + flex: 1 1 auto + min-width: 0 prevents shrink-to-content */}
      <div className="relative flex-1 p-2" style={{ width: '100%', minWidth: 0, backgroundColor: 'var(--ui-bg-editor)' }}>
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
        {/* Host div: width: 100% + flex: 1 1 auto + min-width: 0 prevents shrink-to-content */}
        <div
          className="flex-1 overflow-hidden text-(--ui-text-secondary)"
          style={{ width: '100%', minWidth: 0, height: '100%', minHeight: 0 }}
          ref={hostRef}
        />
      </div>
    </div>
  )
}
)
