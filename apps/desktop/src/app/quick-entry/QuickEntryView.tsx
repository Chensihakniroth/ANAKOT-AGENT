
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { $quickEntryActions } from '@/store/quick-entry'

export function QuickEntry() {
  const actions = useStore($quickEntryActions)
  const [query, setQuery] = useState('')

  const filtered = actions.filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <input
        type="text"
        placeholder="Type a command..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="rounded-lg border bg-background px-4 py-2"
        autoFocus
      />
      <div className="flex flex-col gap-1 overflow-y-auto">
        {filtered.map(action => (
          <button
            key={action.id}
            onClick={action.run}
            className="rounded px-3 py-2 text-left hover:bg-muted"
          >
            {action.label}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground">No actions found</p>
        )}
      </div>
    </div>
  )
}
