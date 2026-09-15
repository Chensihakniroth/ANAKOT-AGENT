import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router-dom'

import { Codicon } from '@/components/ui/codicon'
import { $sessions, $activeSessionId, setActiveSessionId } from '@/store/session'
import { displayModelName } from '@/lib/model-status-label'
import {
  $sessionPickerOpen,
  $sessionPickerQuery,
  $sessionPickerIndex,
  closeSessionPicker,
  setSessionPickerQuery,
  moveSessionPickerIndex,
} from '@/store/session-picker'

export function SessionPickerOverlay() {
  const open = useStore($sessionPickerOpen)
  const query = useStore($sessionPickerQuery)
  const index = useStore($sessionPickerIndex)
  const sessions = useStore($sessions)
  const activeSessionId = useStore($activeSessionId)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      s =>
        (s.title ?? '').toLowerCase().includes(q) ||
        (s.model ?? '').toLowerCase().includes(q) ||
        (s.profile ?? '').toLowerCase().includes(q)
    )
  }, [sessions, query])

  // Reset scroll when selection changes
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const selected = list.children[index] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  // Focus input on open
  useEffect(() => {
    if (open) {
      // Small delay to let the overlay mount
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Global keyboard nav
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveSessionPickerIndex(1, filtered.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveSessionPickerIndex(-1, filtered.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[index]) {
            setActiveSessionId(filtered[index].id)
            closeSessionPicker()
            navigate('/chat')
          }
          break
        case 'Escape':
          e.preventDefault()
          closeSessionPicker()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, index, filtered, navigate])

  if (!open) return null

  const handleSelect = (sessionId: string) => {
    setActiveSessionId(sessionId)
    closeSessionPicker()
    navigate('/chat')
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={closeSessionPicker}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-(--chrome-panel-bg) shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Codicon name="search" size="0.875rem" className="shrink-0 text-(--ui-text-tertiary)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setSessionPickerQuery(e.target.value)}
            placeholder="Search sessions..."
            className="h-6 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-(--ui-text-tertiary)"
          />
          {query && (
            <button
              onClick={() => setSessionPickerQuery('')}
              className="rounded p-0.5 text-(--ui-text-tertiary) hover:text-foreground"
            >
              <Codicon name="close" size="0.75rem" />
            </button>
          )}
        </div>

        {/* Session list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-(--ui-text-tertiary)">
              {query ? 'No sessions match your search' : 'No sessions yet'}
            </div>
          ) : (
            filtered.map((session, i) => {
              const isActive = session.id === activeSessionId
              const isSelected = i === index

              return (
                <button
                  key={session.id}
                  onClick={() => handleSelect(session.id)}
                  className={`flex h-9 w-full items-center gap-2.5 px-3 text-left text-[0.8125rem] transition-colors ${
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
                  }`}
                >
                  {/* Status indicator */}
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />

                  {/* Session info */}
                  <span className="min-w-0 flex-1 truncate">
                    {session.title || 'Untitled'}
                  </span>

                  {/* Meta */}
                  {session.model && (
                    <span className="shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)">
                      {displayModelName(session.model)}
                    </span>
                  )}
                  <span className="shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)">
                    {session.message_count ?? 0}
                  </span>

                  {/* Active check */}
                  {isActive && (
                    <Codicon name="check" size="0.75rem" className="shrink-0 text-primary" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[0.625rem] text-(--ui-text-tertiary)">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-(--ui-bg-elevated) px-1 py-0.5 text-[0.5625rem]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-(--ui-bg-elevated) px-1 py-0.5 text-[0.5625rem]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-(--ui-bg-elevated) px-1 py-0.5 text-[0.5625rem]">Esc</kbd>
            Close
          </span>
          <span className="ml-auto">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
