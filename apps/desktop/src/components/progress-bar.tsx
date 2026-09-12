// Progress bar — app's one progress/meter bar: rounded track with animated fill.
// The track owns role="progressbar" and aria values; the fill is width-driven (determinate)
// or animated (indeterminate). Consumers needing a bespoke look override className/fillClassName.

import * as React from 'react'

import { cn } from '@/lib/utils'

const TRACK_HEIGHT = { sm: 'h-1', default: 'h-1.5', lg: 'h-2' } as const

export interface ProgressProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  value?: number
  indeterminate?: boolean
  animated?: boolean
  destructive?: boolean
  size?: keyof typeof TRACK_HEIGHT
  fillClassName?: string
  fillStyle?: React.CSSProperties
  children?: React.ReactNode
}

export function Progress({ value = 0, indeterminate = false, animated = false, destructive = false, size, fillClassName, fillStyle, children, className, style }: ProgressProps) {
  const pct = indeterminate || !value ? 0 : Math.min(Math.max(value, 0), 1)
  const cls = cn('relative overflow-hidden rounded-full bg-muted', TRACK_HEIGHT[size ?? 'default'])

  return React.createElement('div', { className: cls, role: 'progressbar', 'aria-valuenow': indeterminate ? undefined : pct * 100, 'aria-valuemin': 0, 'aria-valuemax': 100, style: { position: 'relative' } },
    React.createElement('div', {
      className: cn('absolute inset-0 rounded-full bg-current opacity-20', destructive && 'bg-destructive'),
      style: { top: 0, left: 0, right: 0, bottom: 0 }
    }),
    React.createElement('div', {
      className: cn(
        'h-full rounded-full transition-[width] duration-300 ease-out',
        indeterminate && (animated ? 'animate-[marquee_1.5s_infinite_ease-in-out] pointer-events-none' : 'animate-pulse'),
        destructive && 'bg-destructive',
        fillClassName
      ),
      style: { width: indeterminate ? '100%' : `${pct * 100}%`, ...(fillStyle as object) }
    }),
    children
  )
}
