import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { CheckCircle2, CircleIcon, Clipboard, Loader2, X } from '@/lib/icons'
import { todoTree, type TodoItem, type TodoStatus } from '@/lib/todos'
import { cn } from '@/lib/utils'
import { $todosBySession } from '@/store/todos'

interface TodoPanelProps {
  sessionId: string | null
}

/** Status glyph for one todo row. Dashed ring while open, spinner on the
 *  in-progress item, solid check once done, muted slash when cancelled. */
function TodoGlyph({ status }: { status: TodoStatus }) {
  if (status === 'in_progress') {
    return (
      <span className="grid size-[1.1rem] shrink-0 place-items-center rounded-full border border-ring/65 bg-[color-mix(in_srgb,var(--dt-ring)_14%,transparent)]">
        <Loader2 className="size-3 animate-spin text-ring" />
      </span>
    )
  }

  if (status === 'completed') {
    return <CheckCircle2 className="size-[1.1rem] shrink-0 text-emerald-500/80" />
  }

  if (status === 'cancelled') {
    return <X className="size-[1.1rem] shrink-0 text-muted-foreground/45" />
  }

  return <CircleIcon className="size-[1.1rem] shrink-0 text-muted-foreground/60" />
}

/**
 * Live task list for the active session, mounted above the composer input.
 * Fed from `todo` tool events in the message stream (see use-message-stream).
 * Collapses to nothing when the session has no todos.
 */
export function TodoPanel({ sessionId }: TodoPanelProps) {
  const allTodos = useStore($todosBySession)
  const todos = useMemo(() => (sessionId ? (allTodos[sessionId] ?? []) : []), [sessionId, allTodos])

  const rows = useMemo(() => todoTree(todos), [todos])

  if (rows.length === 0) {
    return null
  }

  const counted = todos.filter(t => t.status !== 'cancelled')
  const done = counted.filter(t => t.status === 'completed').length
  const active = todos.find(t => t.status === 'in_progress')

  return (
    <div
      className="composer-no-drag mb-1.5 overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-sm backdrop-blur-md"
      data-slot="composer-todo-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Clipboard className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-xs font-medium text-foreground">
            {counted.length > 0 ? `${done}/${counted.length}` : 'Tasks'}
          </span>
          {active && <span className="truncate text-xs text-muted-foreground/80">— {active.content}</span>}
        </div>
      </div>
      <ul className="max-h-48 overflow-y-auto px-1 py-1">
        {rows.map(([todo, depth]) => (
          <li
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1 text-xs transition-opacity',
              todo.status === 'in_progress' ? 'opacity-100' : 'opacity-60'
            )}
            key={todo.id}
            style={{ paddingLeft: `${Math.min(depth, 4) * 0.9 + 0.5}rem` }}
          >
            <TodoGlyph status={todo.status} />
            <span className="min-w-0 flex-1 truncate text-foreground" title={todo.content}>
              {todo.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}