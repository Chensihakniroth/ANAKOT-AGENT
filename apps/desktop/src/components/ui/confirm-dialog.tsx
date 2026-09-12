import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { ActionStatus } from '@/components/ui/action-status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { AlertTriangle } from '@/lib/icons'
import React from 'react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  busyLabel?: string
  doneLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  busyLabel,
  doneLabel,
  cancelLabel,
  destructive = false
}: ConfirmDialogProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'done' | 'idle' | 'saving'>('idle')
  const [error, setError] = useState<null | string>(null)
  const busy = status === 'saving' || status === 'done'
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm
  const resolvedBusyLabel = busyLabel ?? t.common.loading
  const resolvedDoneLabel = doneLabel ?? t.common.done
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel

  useEffect(() => { if (open) { setStatus('idle'); setError(null) } }, [open])

  async function run() {
    if (busy) return
    setStatus('saving')
    setError(null)
    try {
      await onConfirm()
      setStatus('done')
      window.setTimeout(onClose, 600)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : t.errors.genericFailure)
    }
  }

  return React.createElement(Dialog, { onOpenChange: (value: boolean) => !value && !busy && onClose(), open },
    React.createElement(DialogContent, { className: 'max-w-md', onKeyDown: (event: React.KeyboardEvent) => {
      if ((event.key === 'Enter' || event.key === ' ') && !busy) { event.preventDefault(); void run() }
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose() }
    } },
      React.createElement(DialogHeader, null,
        React.createElement(DialogTitle, null, title),
        description ? React.createElement(DialogDescription, null, description) : null
      ),
      error ? React.createElement('div', { className: 'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive' },
        React.createElement(AlertTriangle, { className: 'mt-0.5 size-3.5 shrink-0' }),
        React.createElement('span', null, error)
      ) : null,
      React.createElement(DialogFooter, null,
        React.createElement(Button, { disabled: busy, onClick: onClose, type: 'button', variant: 'ghost' }, resolvedCancelLabel),
        React.createElement(Button, { disabled: busy, onClick: () => void run(), variant: destructive ? 'destructive' : 'default' },
          React.createElement(ActionStatus, { busy: resolvedBusyLabel, done: resolvedDoneLabel, idle: resolvedConfirmLabel, state: status })
        )
      )
    )
  )
}

interface ConfirmDialogWithCallbacksProps extends ConfirmDialogProps {
  onCancel?: () => void
}

export function ConfirmDialogWithCallbacks({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  busyLabel,
  doneLabel,
  cancelLabel,
  destructive = false,
  onCancel
}: ConfirmDialogWithCallbacksProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'done' | 'idle' | 'saving'>('idle')
  const [error, setError] = useState<null | string>(null)
  const busy = status === 'saving' || status === 'done'
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm
  const resolvedBusyLabel = busyLabel ?? t.common.loading
  const resolvedDoneLabel = doneLabel ?? t.common.done
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel

  useEffect(() => { if (open) { setStatus('idle'); setError(null) } }, [open])

  async function run() {
    if (busy) return
    setStatus('saving')
    setError(null)
    try {
      await onConfirm()
      setStatus('done')
      window.setTimeout(onClose, 600)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : t.errors.genericFailure)
    }
  }

  const handleCancel = () => { onCancel?.(); onClose() }

  return React.createElement(Dialog, { onOpenChange: (value: boolean) => !value && !busy && onClose(), open },
    React.createElement(DialogContent, { className: 'max-w-md', onKeyDown: (event: React.KeyboardEvent) => {
      if ((event.key === 'Enter' || event.key === ' ') && !busy) { event.preventDefault(); void run() }
      if (event.key === 'Escape' && !busy) { event.preventDefault(); handleCancel() }
    } },
      React.createElement(DialogHeader, null,
        React.createElement(DialogTitle, null, title),
        description ? React.createElement(DialogDescription, null, description) : null
      ),
      error ? React.createElement('div', { className: 'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive' },
        React.createElement(AlertTriangle, { className: 'mt-0.5 size-3.5 shrink-0' }),
        React.createElement('span', null, error)
      ) : null,
      React.createElement(DialogFooter, null,
        React.createElement(Button, { disabled: busy, onClick: handleCancel, type: 'button', variant: 'ghost' }, resolvedCancelLabel),
        React.createElement(Button, { disabled: busy, onClick: () => void run(), variant: destructive ? 'destructive' : 'default' },
          React.createElement(ActionStatus, { busy: resolvedBusyLabel, done: resolvedDoneLabel, idle: resolvedConfirmLabel, state: status })
        )
      )
    )
  )
}
