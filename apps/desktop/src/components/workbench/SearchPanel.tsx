import { useStore } from '@nanostores/react'
import { SearchField } from '@/components/ui/search-field'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { $sessions, $sessionsLoading } from '@/store/session'
import { searchSessions, type SessionSearchResult } from '@/anakot'
import { sessionMatchesSearch } from '@/lib/session-search'
import { useState, useCallback, useEffect, useRef } from 'react'

export function SearchPanel() {
  const { t } = useI18n()
  const sessions = useStore($sessions)
  const sessionsLoading = useStore($sessionsLoading)
  const [query, setQuery] = useState('')
  const [serverMatches, setServerMatches] = useState<SessionSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (!trimmedQuery) {
      setServerMatches([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    let cancelled = false
    const id = window.setTimeout(() => {
      void searchSessions(trimmedQuery)
        .then(res => {
          if (!cancelled) {
            setServerMatches(res.results)
            setIsSearching(false)
          }
        })
        .catch(() => {
          if (!cancelled) setIsSearching(false)
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [trimmedQuery])

  const localMatches = trimmedQuery
    ? sessions.filter(s => sessionMatchesSearch(s, trimmedQuery)).slice(0, 20)
    : []

  const hasResults = localMatches.length > 0 || serverMatches.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search input */}
      <div className="shrink-0 px-2 py-1.5">
        <SearchField
          inputRef={searchInputRef}
          onChange={setQuery}
          placeholder="Search sessions..."
          value={query}
        />
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!trimmedQuery ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <Codicon name="search" size="1.5rem" className="text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Search sessions by title or content</span>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Codicon name="loading" size="1rem" className="animate-spin text-muted-foreground" />
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <span className="text-xs text-muted-foreground">No results for "{trimmedQuery}"</span>
          </div>
        ) : (
          <div className="px-1 py-0.5">
            {localMatches.map(session => (
              <button
                key={session.id}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                type="button"
              >
                <Codicon name="symbol-file" size="0.75rem" className="shrink-0" />
                <span className="truncate">{session.title || 'Untitled'}</span>
              </button>
            ))}
            {serverMatches.map(match => (
              <button
                key={`server-${match.session_id}`}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                type="button"
              >
                <Codicon name="cloud" size="0.75rem" className="shrink-0" />
                <span className="truncate">{match.snippet || match.session_id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
