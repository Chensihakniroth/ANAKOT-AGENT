'use client'

import { type FC, useState } from 'react'

import { cn } from '@/lib/utils'

interface UndoEntry {
  past: string[]
  future: string[]
}

interface UndoHistoryProps {
  value: string
  onRestore: (value: string) => void
  className?: string
}

/** Undo/redo history manager for the composer. */
export function useUndoHistory(initialValue = '', limit = 50) {
  const [history, setHistory] = useState<UndoEntry>({ past: [], future: [] })
  const [current, setCurrent] = useState(initialValue)

  const push = (newValue: string) => {
    if (newValue === current) return
    setHistory(h => ({
      past: [...h.past.slice(-limit), current],
      future: [],
    }))
    setCurrent(newValue)
  }

  const undo = (): string | null => {
    if (history.past.length === 0) return null
    const previous = history.past[history.past.length - 1]
    setHistory(h => ({
      past: h.past.slice(0, -1),
      future: [current, ...h.future],
    }))
    setCurrent(previous)
    return previous
  }

  const redo = (): string | null => {
    if (history.future.length === 0) return null
    const next = history.future[0]
    setHistory(h => ({
      past: [...h.past, current],
      future: h.future.slice(1),
    }))
    setCurrent(next)
    return next
  }

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  return { current, push, undo, redo, canUndo, canRedo }
}

/** Undo/redo button pair for the composer toolbar. */
export const UndoHistory: FC<UndoHistoryProps> = ({ value, onRestore, className }) => {
  const { push, undo, redo, canUndo, canRedo } = useUndoHistory(value)

  return (
    <div className={cn('flex gap-0.5', className)}>
      <button
        disabled={!canUndo}
        onClick={() => {
          const prev = undo()
          if (prev !== null) onRestore(prev)
        }}
        className={cn('rounded px-1.5 py-0.5 text-xs text-muted-foreground', 'hover:text-foreground disabled:opacity-30')}
        title="Undo"
      >
        ↩
      </button>
      <button
        disabled={!canRedo}
        onClick={() => {
          const next = redo()
          if (next !== null) onRestore(next)
        }}
        className={cn('rounded px-1.5 py-0.5 text-xs text-muted-foreground', 'hover:text-foreground disabled:opacity-30')}
        title="Redo"
      >
        ↪
      </button>
    </div>
  )
}
