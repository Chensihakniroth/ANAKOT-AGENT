// Debug inspector — dev-only panel that surfaces app state for debugging.
// Mounted only in dev mode via window.anakotDesktop.debugInspector.

import React from 'react'
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState, type FC } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { $sessions } from '@/store/session'

export const DebugInspector: FC = () => {
  const [open, setOpen] = useState(false)
  const sessions = useStore($sessions)

  const isDebugInspector = typeof window !== 'undefined' && (window as any).anakotDesktop?.debugInspector
  useEffect(() => { if (isDebugInspector) setOpen(true) }, [])

  if (!open) return null

  return React.createElement('div', {
    className: cn('fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-background p-4 shadow-xl font-mono text-xs'),
    'data-debug-inspector': ''
  },
    React.createElement('div', { className: 'flex items-center justify-between mb-2' },
      React.createElement('h3', null, 'Debug Inspector'),
      React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => setOpen(false) }, 'Close')
    ),
    React.createElement('div', { className: 'space-y-1' },
      React.createElement('div', null, `Sessions: ${sessions?.length ?? 0}`),
      React.createElement('div', null, `Active: ${sessions?.[0]?.id ?? 'none'}`)
    )
  )
}
