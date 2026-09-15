import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { $quickEntryActions } from '@/store/quick-entry'

export function QuickEntry() {
  const actions = useStore($quickEntryActions)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter(
      a =>
        a.label.toLowerCase().includes(q) ||
        (a.category ?? '').toLowerCase().includes(q)
    )
  }, [actions, query])

  // Reset selection on query change
  useEffect(() => setIndex(0), [query])

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[index] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [index])

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setIndex(i => Math.min(i + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[index]) {
            filtered[index].run?.()
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, filtered])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    for (const action of filtered) {
      const cat = action.category ?? 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(action)
    }
    return groups
  }, [filtered])

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Codicon name="search" size="0.875rem" className="shrink-0 text-(--ui-text-tertiary)" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="h-6 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-(--ui-text-tertiary)"
          autoFocus
        />
      </div>

      {/* Results */}
      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-(--ui-text-tertiary)">
            {query ? 'No actions found' : 'No quick actions registered'}
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              {/* Category header */}
              <div className="px-3 pb-1 pt-2 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-tertiary)">
                {category}
              </div>
              {items.map(action => {
                // Compute global index for selection highlighting
                const globalIndex = filtered.indexOf(action)
                const isSelected = globalIndex === index

                return (
                  <button
                    key={action.id}
                    onClick={() => action.run?.()}
                    className={`flex h-8 w-full items-center gap-2.5 px-3 text-left text-[0.8125rem] transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
                    }`}
                  >
                    {action.icon ? (
                      <Codicon name={action.icon} size="0.875rem" className="shrink-0 text-(--ui-text-tertiary)" />
                    ) : (
                      <Codicon name="symbol-misc" size="0.875rem" className="shrink-0 text-(--ui-text-tertiary)" />
                    )}
                    <span className="truncate">{action.label}</span>
                    {action.shortcut && (
                      <kbd className="ml-auto shrink-0 rounded border border-border bg-(--ui-bg-elevated) px-1.5 py-0.5 text-[0.625rem] text-(--ui-text-tertiary)">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[0.625rem] text-(--ui-text-tertiary)">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-(--ui-bg-elevated) px-1 py-0.5 text-[0.5625rem]">↑↓</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-(--ui-bg-elevated) px-1 py-0.5 text-[0.5625rem]">↵</kbd>
          Run
        </span>
        <span className="ml-auto">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
