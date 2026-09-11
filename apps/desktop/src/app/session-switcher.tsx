import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { sessionTitle } from '@/lib/chat-runtime'
import { cn } from '@/lib/utils'
import { $activeSessionId, $sessions } from '@/store/session'
import {
  $switcherIndex,
  $switcherOpen,
  closeSwitcher,
  moveSwitcherIndex,
  setSwitcherIndex
} from '@/store/session-switcher'

import { sessionRoute } from '@/app/routes'

// Keyboard-driven session switcher HUD — opened via Ctrl/Cmd+Tab or Ctrl/Cmd+K.
// Compact list of recent sessions with keyboard navigation. No Dialog: Tab stays global.
export function SessionSwitcher() {
  const open = useStore($switcherOpen)
  const sessions = useStore($sessions)
  const index = useStore($switcherIndex)
  const activeSessionId = useStore($activeSessionId)
  const navigate = useNavigate()
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the selected row into view
  useEffect(() => {
    if (open) {
      activeRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [index, open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveSwitcherIndex(1, sessions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveSwitcherIndex(-1, sessions.length)
          break
        case 'Enter':
          e.preventDefault()
          if (sessions[index]) {
            pick(sessions[index].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          closeSwitcher()
          break
        default:
          // Number keys 1-9 for quick selection
          if (e.key >= '1' && e.key <= '9') {
            const i = parseInt(e.key) - 1
            if (i < sessions.length) {
              e.preventDefault()
              setSwitcherIndex(i)
              pick(sessions[i].id)
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, sessions, index])

  if (!open || sessions.length === 0) {
    return null
  }

  const pick = (sessionId: string) => {
    closeSwitcher()
    navigate(sessionRoute(sessionId))
  }

  return createPortal(
    <>
      {/* Transparent click-catcher: click-away closes */}
      <div
        className="fixed inset-0 z-[100]"
        onMouseDown={(e) => {
          e.preventDefault()
          closeSwitcher()
        }}
      />
      <div
        className={cn(
          'fixed left-1/2 top-[20vh] z-[101] w-[min(24rem,calc(100vw-2rem))]',
          'max-h-[min(24rem,60vh)] overflow-y-auto',
          'rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) shadow-xl',
          'select-none p-1.5'
        )}
      >
        <div className="px-2.5 py-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground/70">
          Switch Session
        </div>
        {sessions.map((session, i) => {
          const selected = i === index
          const isActive = session.id === activeSessionId

          return (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors',
                'cursor-pointer',
                selected
                  ? 'bg-(--ui-accent-secondary) text-(--ui-accent-foreground)'
                  : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(session.id)
              }}
              ref={selected ? activeRef : undefined}
            >
              {/* Active indicator */}
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  isActive ? 'bg-green-400' : 'bg-transparent'
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[0.82rem]">
                {sessionTitle(session)}
              </span>
              {i < 9 && (
                <span
                  className={cn(
                    'shrink-0 font-mono text-[0.62rem] tabular-nums',
                    selected
                      ? 'text-(--ui-accent-foreground)/70'
                      : 'text-(--ui-text-quaternary)'
                  )}
                >
                  {i + 1}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>,
    document.body
  )
}
