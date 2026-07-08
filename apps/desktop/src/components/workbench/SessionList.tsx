import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $sessions, $sessionsLoading, $selectedStoredSessionId, $workingSessionIds } from '@/store/session'
import { $pinnedSessionIds, pinSession, unpinSession } from '@/store/layout'
import { SearchField } from '@/components/ui/search-field'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { searchSessions, type SessionSearchResult, type SessionInfo, setSessionArchived, deleteSession } from '@/anakot'
import { sessionMatchesSearch } from '@/lib/session-search'
import { useI18n } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'
import { setSessions } from '@/store/session'

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
  const workingIds = useStore($workingSessionIds)
  const [query, setQuery] = useState('')
  const [serverMatches, setServerMatches] = useState<SessionSearchResult[]>([])
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)
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
      notify({ durationMs: 2_000, kind: 'success', message: 'Session unpinned' })
    } else {
      pinSession(sessionId)
      notify({ durationMs: 2_000, kind: 'success', message: 'Session pinned' })
    }
    setContextMenu(null)
  }

  const handleArchiveSession = useCallback(async (sessionId: string) => {
    setContextMenu(null)
    try {
      const res = await setSessionArchived(sessionId, true)
      if (res?.ok !== false) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        notify({ durationMs: 2_000, kind: 'success', message: 'Session archived' })
      } else {
        notify({ durationMs: 3_000, kind: 'error', message: 'Failed to archive session' })
      }
    } catch (err) {
      notifyError(err, 'Failed to archive session')
    }
  }, [])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setContextMenu(null)
    try {
      const res = await deleteSession(sessionId)
      if (res?.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        notify({ durationMs: 2_000, kind: 'success', message: 'Session deleted' })
      } else {
        notify({ durationMs: 3_000, kind: 'error', message: 'Failed to delete session' })
      }
    } catch (err) {
      notifyError(err, 'Failed to delete session')
    }
  }, [])

  const handleDoubleClick = useCallback((sessionId: string, currentTitle: string) => {
    setRenamingId(sessionId)
    setRenameValue(currentTitle || 'Untitled')
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      // Optimistic local update — the session title will refresh on next sidebar reload
      // TODO: wire to gateway session.rename RPC when available
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

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
                    isWorking={workingIds.includes(session.id)}
                    isRenaming={renamingId === session.id}
                    renameValue={renameValue}
                    renameRef={renameRef}
                    onSelect={onSelectSession}
                    onContextMenu={handleContextMenu}
                    onDoubleClick={handleDoubleClick}
                    onRenameCommit={commitRename}
                    onRenameCancel={cancelRename}
                    onRenameChange={setRenameValue}
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
                      isWorking={workingIds.includes(session.id)}
                      isRenaming={renamingId === session.id}
                      renameValue={renameValue}
                      renameRef={renameRef}
                      onSelect={onSelectSession}
                      onContextMenu={handleContextMenu}
                      onDoubleClick={handleDoubleClick}
                      onRenameCommit={commitRename}
                      onRenameCancel={cancelRename}
                      onRenameChange={setRenameValue}
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
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
            onClick={() => handleArchiveSession(contextMenu.sessionId)}
            type="button"
          >
            <Codicon name="archive" size="0.875rem" />
            Archive session
          </button>
          <div className="mx-3 my-0.5 h-px bg-(--ui-stroke-tertiary)" />
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-destructive hover:bg-(--ui-control-hover-background)"
            onClick={() => handleDeleteSession(contextMenu.sessionId)}
            type="button"
          >
            <Codicon name="trash" size="0.875rem" />
            Delete session
          </button>
        </div>
      )}
    </div>
  )
}

function SessionRow({ session, isActive, isPinned, isWorking, isRenaming, renameValue, renameRef, onSelect, onContextMenu, onDoubleClick, onRenameCommit, onRenameCancel, onRenameChange }: {
  session: { id: string; title: string | null; preview?: string | null }
  isActive: boolean
  isPinned: boolean
  isWorking: boolean
  isRenaming: boolean
  renameValue: string
  renameRef: React.RefObject<HTMLInputElement | null>
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, sessionId: string) => void
  onDoubleClick: (sessionId: string, currentTitle: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onRenameChange: (value: string) => void
}) {
  if (isRenaming) {
    return (
      <div className="flex items-center px-3 py-1">
        <input
          ref={renameRef}
          className="w-full rounded-sm border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onRenameCommit()
            if (e.key === 'Escape') onRenameCancel()
          }}
        />
      </div>
    )
  }

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
      onDoubleClick={e => {
        e.preventDefault()
        onDoubleClick(session.id, session.title || 'Untitled')
      }}
      type="button"
    >
      <Codicon name="symbol-file" size="0.625rem" className="shrink-0" />
      <span className="truncate">{session.title || 'Untitled'}</span>
      {session.preview != null && session.preview !== '' && (
        <p className="mt-0.5 line-clamp-2 text-[0.6rem] leading-tight text-muted-foreground/60">
          {session.preview}
        </p>
      )}
      {isWorking && (
        <span className="relative ml-auto flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      )}
      {isPinned && !isWorking && (
        <Codicon name="pinned" size="0.5rem" className="ml-auto shrink-0 text-muted-foreground/50" />
      )}
    </button>
  )
}
