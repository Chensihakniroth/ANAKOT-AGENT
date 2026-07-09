import type { ReactNode } from 'react'
import { useEffect, useState, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { AlertTriangle } from '@/lib/icons'

interface PromptDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (value: string) => Promise<void> | void
  title: ReactNode
  description?: ReactNode
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  busyLabel?: string
  cancelLabel?: string
}

export function PromptDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmLabel,
  busyLabel,
  cancelLabel,
}: PromptDialogProps) {
  const { t } = useI18n()
  const [value, setValue] = useState(defaultValue)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState<null | string>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = status === 'saving' || status === 'done'
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm
  const resolvedBusyLabel = busyLabel ?? t.common.loading
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setStatus('idle')
      setError(null)
      // Focus input and select all text after a tiny delay for dialog animation
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 100)
    }
  }, [open, defaultValue])

  async function run() {
    if (busy || !value.trim()) return

    setStatus('saving')
    setError(null)

    try {
      await onConfirm(value)
      setStatus('done')
      window.setTimeout(onClose, 600)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : t.errors.genericFailure)
    }
  }

  return (
    <Dialog onOpenChange={val => !val && !busy && onClose()} open={open}>
      <DialogContent
        className="max-w-md"
        onKeyDown={event => {
          if (event.key === 'Enter' && !busy && value.trim()) {
            event.preventDefault()
            void run()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="py-2">
          <Input 
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button disabled={busy} onClick={onClose} type="button" variant="ghost">
            {resolvedCancelLabel}
          </Button>
          <Button disabled={busy || !value.trim()} onClick={() => void run()} variant="default">
            {busy ? resolvedBusyLabel : resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
