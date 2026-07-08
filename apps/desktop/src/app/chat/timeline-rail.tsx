/**
 * Timeline Rail — compact left sidebar for navigating long conversations.
 *
 * Shows a scrolled list of message snippets for threads with >10 messages.
 * Clicking a snippet scrolls the chat to that message.
 */

import { useStore } from '@nanostores/react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { $messages } from '@/store/session'
import { chatMessageText } from '@/lib/chat-messages'
import { cn } from '@/lib/utils'
import { Codicon } from '@/components/ui/codicon'

/** Max visible messages before the timeline rail appears. */
const SHOW_THRESHOLD = 10
const MAX_SNIPPET_LENGTH = 60

function messageSnippet(msg: { role: string; parts: unknown[] }): string {
  const raw = chatMessageText(msg as any)
  const cleaned = raw
    .replace(/<[^>]+>/g, '')            // strip HTML tags
    .replace(/```[\s\S]*?```/g, '')     // strip code blocks
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim()

  if (!cleaned) {
    // Fallback: show first text part content
    return '(no text)'
  }

  return cleaned.length > MAX_SNIPPET_LENGTH
    ? cleaned.slice(0, MAX_SNIPPET_LENGTH) + '…'
    : cleaned
}

function roleBadge(role: string): { label: string; className: string } {
  switch (role) {
    case 'user':
      return { label: 'U', className: 'bg-primary/20 text-primary' }
    case 'assistant':
      return { label: 'A', className: 'bg-accent/30 text-accent-foreground' }
    default:
      return { label: 'S', className: 'bg-muted text-muted-foreground' }
  }
}

export function TimelineRail() {
  const messages = useStore($messages)
  const listRef = useRef<HTMLDivElement>(null)

  // Only visible (non-hidden) messages
  const visibleMessages = useMemo(
    () => messages.filter(m => !m.hidden),
    [messages]
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const scrollToMessage = useCallback((messageId: string) => {
    setActiveId(messageId)

    // Try data-message-id attribute first (assistant-ui convention)
    const el =
      document.querySelector(`[data-message-id="${messageId}"]`) ??
      document.getElementById(`message-${messageId}`)

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // Don't render at all for short threads
  if (visibleMessages.length <= SHOW_THRESHOLD) {
    return null
  }

  return (
    <div className="relative flex h-full w-[11rem] shrink-0 flex-col border-r border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-(--ui-stroke-tertiary) px-3 py-2">
        <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="list-tree" size="0.75rem" />
        <span className="text-[0.6rem] font-medium uppercase tracking-wider text-(--ui-text-tertiary)">
          Timeline
        </span>
        <span className="ml-auto text-[0.55rem] tabular-nums text-(--ui-text-tertiary)">
          {visibleMessages.length}
        </span>
      </div>

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain py-1 scrollbar-thin"
        ref={listRef}
      >
        {visibleMessages.map(msg => {
          const snippet = messageSnippet(msg)
          const badge = roleBadge(msg.role)
          const isActive = activeId === msg.id

          return (
            <button
              className={cn(
                'flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-(--chrome-action-hover)',
                isActive && 'bg-(--chrome-action-active)'
              )}
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              type="button"
            >
              {/* Role badge */}
              <span
                className={cn(
                  'mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-sm text-[0.45rem] font-bold leading-none',
                  badge.className
                )}
              >
                {badge.label}
              </span>

              {/* Snippet */}
              <span className="min-w-0 truncate text-[0.6rem] leading-snug text-(--ui-text-secondary) [line-clamp:2]">
                {snippet}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
