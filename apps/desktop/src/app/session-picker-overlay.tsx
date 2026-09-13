
import { useStore } from '@nanostores/react'

import { $sessions } from '@/store/session'

export function SessionPickerOverlay() {
  const sessions = useStore($sessions)

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <h2 className="text-xl font-semibold">Select a Session</h2>
      <div className="flex flex-col gap-1 overflow-y-auto">
        {sessions.map(session => (
          <button
            key={session.id}
            className="rounded-lg border p-3 text-left transition-colors hover:bg-muted"
          >
            <h3 className="font-medium">{session.title || 'Untitled'}</h3>
            <p className="text-xs text-muted-foreground">
              {session.message_count ?? 0} messages
            </p>
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="text-muted-foreground">No sessions found</p>
        )}
      </div>
    </div>
  )
}
