import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import {
  closeFindBar,
  findNext,
  findPrevious,
  formatFindMatchLabel,
  openFindBar,
  setFindQuery,
  updateFindResults,
  $findInPage
} from '@/store/find-in-page'

export function FindBar() {
  const state = useStore($findInPage)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openFindBar()
        return
      }

      if (!state.active) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeFindBar()
      } else if (modifier && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        event.shiftKey ? findPrevious() : findNext()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [state.active])

  useEffect(() => {
    if (!state.active) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [state.active])

  useEffect(() => {
    const detach = window.anakotDesktop?.onFoundInPage?.(result => {
      updateFindResults(result.activeMatchOrdinal, result.count)
    })
    return detach
  }, [])

  if (!state.active) return null

  return (
    <div className="fixed right-4 top-3 z-50 flex items-center gap-1 rounded-md border border-border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur">
      <input
        ref={inputRef}
        aria-label="Find in page"
        className="w-52 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        onChange={event => setFindQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.shiftKey ? findPrevious() : findNext()
          }
        }}
        placeholder="Find"
        value={state.query}
      />
      <span className="min-w-10 text-center text-xs text-muted-foreground">
        {formatFindMatchLabel(state.query, state.matchOrdinal, state.matchCount)}
      </span>
      <button aria-label="Previous match" className="size-6 text-muted-foreground hover:text-foreground" onClick={findPrevious} type="button">
        ↑
      </button>
      <button aria-label="Next match" className="size-6 text-muted-foreground hover:text-foreground" onClick={findNext} type="button">
        ↓
      </button>
      <button aria-label="Close find bar" className="size-6 text-muted-foreground hover:text-foreground" onClick={closeFindBar} type="button">
        ×
      </button>
    </div>
  )
}
