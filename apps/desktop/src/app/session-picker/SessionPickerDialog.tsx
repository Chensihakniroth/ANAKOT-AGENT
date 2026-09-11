import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useNavigate } from 'react-router-dom'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { listAllProfileSessions } from '@/anakot'
import { sessionTitle } from '@/lib/chat-runtime'
import { MessageCircle, Check } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { SessionInfo } from '@/types/anakot'

import { $activeSessionId } from '@/store/session'
import { $sessionPickerOpen, closeSessionPicker } from './store'
import { sessionRoute } from '@/app/routes'

interface SessionPickerDialogProps {
  onResume?: (sessionId: string) => void
}

export function SessionPickerDialog({ onResume }: SessionPickerDialogProps) {
  const open = useStore($sessionPickerOpen)
  const navigate = useNavigate()
  const activeSessionId = useStore($activeSessionId)
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }

    setLoading(true)
    listAllProfileSessions(200, 1, 'exclude')
      .then(({ sessions }) => setSessions(sessions))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [open])

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions
    const lower = search.toLowerCase()
    return sessions.filter(
      s =>
        s.title?.toLowerCase().includes(lower) ||
        s.preview?.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower)
    )
  }, [sessions, search])

  const handleSelect = (sessionId: string) => {
    closeSessionPicker()
    if (onResume) {
      onResume(sessionId)
    } else {
      navigate(sessionRoute(sessionId))
    }
  }

  return (
    <DialogPrimitive.Root onOpenChange={open ? () => closeSessionPicker() : undefined} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-[101] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) shadow-lg"
        >
          <DialogPrimitive.Title className="sr-only">Switch Session</DialogPrimitive.Title>
          <Command className="bg-transparent" loop>
            <CommandInput
              onValueChange={setSearch}
              placeholder="Search sessions..."
              value={search}
            />
            <CommandList className="max-h-[min(24rem,60vh)]">
              <CommandEmpty>
                {loading ? 'Loading...' : 'No sessions found.'}
              </CommandEmpty>
              <CommandGroup>
                {filteredSessions.map(session => {
                  const title = sessionTitle(session)
                  const preview = session.preview?.trim()
                  const isActive = session.id === activeSessionId

                  return (
                    <CommandItem
                      className="gap-2.5"
                      key={session.id}
                      onSelect={() => handleSelect(session.id)}
                      value={`${title} ${preview ?? ''} ${session.id}`}
                    >
                      <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col leading-snug">
                        <span className="truncate">{title}</span>
                        {preview ? (
                          <span className="truncate text-xs text-muted-foreground/70">{preview}</span>
                        ) : null}
                      </span>
                      {isActive && (
                        <Check className="ml-auto size-3.5 shrink-0 text-(--ui-accent-secondary)" />
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
