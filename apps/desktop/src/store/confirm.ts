// Confirm dialog store — imperative front door to a confirm dialog,
// for handlers that want the answer inline (like `if (!ok) return`).
// A surface that wants the busy → done beat or an inline error should
// mount <ConfirmDialog> itself and hand it the async onConfirm.

import { atom } from 'nanostores'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void
}

export const $confirmRequest = atom<null | PendingConfirm>(null)

/** Show a confirm dialog and wait for the user's answer. */
export function showConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise(resolve => {
    $confirmRequest.set({ ...request, resolve })
  })
}

/** Resolve the currently pending confirm request. */
export function resolveConfirm(confirmed: boolean): void {
  const pending = $confirmRequest.get()
  if (!pending) return
  pending.resolve(confirmed)
  $confirmRequest.set(null)
}

/** Dismiss the currently pending confirm request without answering. */
export function dismissConfirm(): void {
  const pending = $confirmRequest.get()
  if (!pending) return
  pending.resolve(false)
  $confirmRequest.set(null)
}
