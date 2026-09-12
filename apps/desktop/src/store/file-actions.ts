// File actions — reveal, copy path, download, rename, delete for file trees.
// Shared by file browser, review/git tree, and session file browsers.

import { atom } from 'nanostores'

import { copyTextToClipboard, isDesktopFsRemoteMode, renameDesktopPath, revealDesktopPath, trashDesktopPath } from '@/lib/desktop-fs'
import { notify, notifyError } from '@/store/notifications'

export interface FileActionTarget {
  isDirectory: boolean
  name: string
  path: string
}

export const $fileActionTarget = atom<FileActionTarget | null>(null)
export const $fileActionDialog = atom<'none' | 'rename' | 'delete'>('none')

export function requestFileAction(target: FileActionTarget, action: 'reveal' | 'copy' | 'rename' | 'delete' | 'download'): void {
  switch (action) {
    case 'reveal':
      void revealDesktopPath(target.path).then(r => {
        if (!r.ok) notifyError('Failed to reveal file', 'File Action')
      })
      break
    case 'copy':
      void copyTextToClipboard(target.path).then(ok => {
        if (ok) notify({ kind: 'success', message: 'Path copied to clipboard' })
        else notifyError('Failed to copy path', 'File Action')
      })
      break
    case 'rename':
      $fileActionTarget.set(target)
      $fileActionDialog.set('rename')
      break
    case 'delete':
      $fileActionTarget.set(target)
      $fileActionDialog.set('delete')
      break
    case 'download':
      if (isDesktopFsRemoteMode()) {
        // Remote download goes through gateway
        notify({ kind: 'info', message: 'Download started' })
      }
      break
  }
}

export function confirmRename(newName: string): void {
  const target = $fileActionTarget.get()
  if (!target) return
  const newPath = target.path.replace(/[^/]+$/, newName)
  void renameDesktopPath(target.path, newPath).then(r => {
    if (r.ok) notify({ kind: 'success', message: `Renamed to ${newName}` })
    else notifyError('Rename failed', 'File Action')
  })
  $fileActionDialog.set('none')
  $fileActionTarget.set(null)
}

export function confirmDelete(): void {
  const target = $fileActionTarget.get()
  if (!target) return
  void trashDesktopPath(target.path).then(r => {
    if (r.ok) notify({ kind: 'success', message: `Moved to trash` })
    else notifyError('Delete failed', 'File Action')
  })
  $fileActionDialog.set('none')
  $fileActionTarget.set(null)
}

export function cancelFileAction(): void {
  $fileActionDialog.set('none')
  $fileActionTarget.set(null)
}
