import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $sessions, $sessionsLoading, $selectedStoredSessionId } from '@/store/session'
import { $pinnedSessionIds, pinSession, unpinSession } from '@/store/layout'
import { SearchField } from '@/components/ui/search-field'
import { useState, useRef, useEffect, useMemo } from 'react'
import { searchSessions, type SessionSearchResult, type SessionInfo } from '@/anakot'
import { sessionMatchesSearch } from '@/lib/session-search'
import { useI18n } from '@/i18n'

interface SessionListProps {
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
}

interface SessionGroup {
  id: string
  label: string
  path: string | null
  sessions: SessionInfo[]
}

function baseName(path: string) {
  return path.replace(/[/\\/]+$/, '').split(/[/\\]/).filter(Boolean).pop()
}

function groupSessionsByWorkspace(sessions: SessionInfo[], noWorkspaceLabel: string): SessionGroup[] {
  const groups = new Map<string, SessionGroup>()
  for (const session of sessions) {
    const path = session.cwd?.trim() || ''
    const id = path || '__no_workspace__'
    const label = baseName(path) || path || noWorkspaceLabel
    const group = groups.get(id) ?? { id, label, path: path || null, sessions: [] }
    group.sessions.push(session)
    groups.set(id, group)
  }
  for (const group of groups.values()) {
    group.sessions.sort((a, b) => (b.started_at || 0) - (a.started_at || 0))
  }
  return [...groups.values()]
}

export function SessionList({ onSelectSession, onNewSession }: SessionListProps) {
  const { t } = useI18n()
  const sessions = useStore($sessions)
  const selectedId = useStore($selectedStoredSessionId)
  const loading = useStore($sessionsLoading)
  const pinnedIds = useStore($pinnedSessionIds)
  const [query, setQuery] = useState('')
  const [serverMatches, setServerMatches] = useState<SessionSearchResult[]>([])
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (!trimmedQuery) { setServerMatches([]); return }
    let cancelled = false
    const id = window.setTimeout(() => {
      void searchSessions(trimmedQuery).then(res => {
        if (!cancelled) setServerMatches(res.results)
      }).catch(() => undefined)
    }, 200)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [trimmedQuery])

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      // Close if clicking outside the context menu
      const target = e.target as HTMLElement
      if (!target.closest('[data-context-menu]')) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [contextMenu])

  const filtered = trimmedQuery
    ? sessions.filter(s => sessionMatchesSearch(s, trimmedQuery)).slice(0, 20)
    : sessions

  const pinnedSessions = filtered.filter(s => pinnedIds.includes(s.id))
  const unpinnedSessions = filtered.filter(s => !pinnedIds.includes(s.id))

  const workspaceGroups = useMemo(
    () => groupSessionsByWorkspace(unpinnedSessions, t.sidebar?.noWorkspace || 'No workspace'),
    [unpinnedSessions, t.sidebar?.noWorkspace]
  )

  // All groups start collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(workspaceGroups.map(g => g.id))
  })

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ sessionId, x: e.clientX, y: e.clientY })
  }

  const handlePinSession = (sessionId: string) => {
    if (pinnedIds.includes(sessionId)) {
      unpinSession(sessionId)
    } else {
      pinSession(sessionId)
    }
    setContextMenu(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* New session + search header */}
      <div className="shrink-0 px-2 pt-1.5 pb-1">
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
            onClick={onNewSession}
            type="button"
          >
            <Codicon name="plus" size="0.75rem" />
            New session
          </button>
          <div className="ml-auto text-[0.6rem] text-muted-foreground">
            {sessions.length}
          </div>
        </div>
        <div className="mt-1">
          <SearchField
            inputRef={searchRef}
            onChange={setQuery}
            placeholder="Search sessions..."
            value={query}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <Codicon name="loading" size="1rem" className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[0.65rem] text-muted-foreground">
            {trimmedQuery ? 'No results' : 'No sessions yet'}
          </div>
        ) : (
          <>
            {/* Pinned sessions */}
            {pinnedSessions.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <Codicon name="pinned" size="0.625rem" className="text-muted-foreground" />
                  <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                    Pinned
                  </span>
                  <span className="ml-auto text-[0.55rem] text-muted-foreground/50">
                    {pinnedSessions.length}
                  </span>
                </div>
                {pinnedSessions.map(session => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === selectedId}
                    isPinned={true}
                    onSelect={onSelectSession}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            )}

            {/* Sessions grouped by workspace */}
            {workspaceGroups.map(group => {
              const isCollapsed = collapsedGroups.has(group.id)
              return (
                <div key={group.id} className="mb-1">
                  <button
                    className="flex w-full items-center gap-1.5 px-3 py-1 text-left hover:bg-(--ui-control-hover-background)"
                    onClick={() => toggleGroup(group.id)}
                    type="button"
                  >
                    <Codicon
                      name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                      size="0.625rem"
                      className="shrink-0 text-muted-foreground"
                    />
                    <Codicon name="folder" size="0.625rem" className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="text-[0.55rem] text-muted-foreground/50">
                      {group.sessions.length}
                    </span>
                  </button>
                  {!isCollapsed && group.sessions.map(session => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={session.id === selectedId}
                      isPinned={pinnedIds.includes(session.id)}
                      onSelect={onSelectSession}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          data-context-menu
          className="fixed z-[9999] min-w-[180px] rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) py-1 shadow-xl"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
            onClick={() => handlePinSession(contextMenu.sessionId)}
            type="button"
          >
            <Codicon name={pinnedIds.includes(contextMenu.sessionId) ? 'pinned' : 'pin'} size="0.875rem" />
            {pinnedIds.includes(contextMenu.sessionId) ? 'Unpin session' : 'Pin session'}
          </button>
        </div>
      )}
    </div>
  )
}

function SessionRow({ session, isActive, isPinned, onSelect, onContextMenu }: {
  session: { id: string; title: string | null }
  isActive: boolean
  isPinned: boolean
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, sessionId: string) => void
}) {
  return (
    <button
      className={cn(
        'group flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        isActive
          ? 'bg-(--ui-control-active-background) text-foreground'
          : 'text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-(--ui-text-secondary)'
      )}
      onClick={() => onSelect(session.id)}
      onContextMenu={e => onContextMenu(e, session.id)}
      type="button"
    >
      <Codicon name="symbol-file" size="0.625rem" className="shrink-0" />
      <span className="truncate">{session.title || 'Untitled'}</span>
      {isPinned && (
        <Codicon name="pinned" size="0.5rem" className="ml-auto shrink-0 text-muted-foreground/50" />
      )}
    </button>
  )
}
