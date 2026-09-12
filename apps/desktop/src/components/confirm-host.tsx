'use client'

import React from 'react'
import { useStore } from '@nanostores/react'
import { type FC, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialogWithCallbacks, ConfirmDialog as ConfirmDialogBase } from '@/components/ui/confirm-dialog'
import { $confirmRequest, type PendingConfirm } from '@/store/confirm'

/** Global mount point for `confirm()` from `@/store/confirm`.
 * Mounted once at the shell (like NotificationStack backs notify()). */

export const ConfirmHost: FC = () => {
  const request = useStore($confirmRequest)
  const [shown, setShown] = useState<null | PendingConfirm>(request)

  useEffect(() => {
    if (request) setShown(request)
  }, [request])

  if (!shown) return null

  const onClose = () => setShown(null)

  return React.createElement(ConfirmDialogWithCallbacks, {
    open: true,
    onClose,
    title: shown.title,
    description: shown.description,
    confirmLabel: shown.confirmLabel ?? 'Confirm',
    cancelLabel: shown.cancelLabel ?? 'Cancel',
    onConfirm: () => {
      const confirmed = true
      setShown(null)
      request!.resolve(confirmed)
    },
    onCancel: () => {
      const r = request
      if (r) { setShown(null); r.resolve(false) }
    }
  })
}