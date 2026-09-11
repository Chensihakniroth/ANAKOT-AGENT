import { atom } from 'nanostores'

export type ContextMenuKind = 'session' | 'message' | 'file' | 'custom'

export interface ContextMenuState {
  x: number
  y: number
  kind: ContextMenuKind
  // Kind-specific payload
  sessionId?: string
  messageId?: string
  filePath?: string
  items?: ContextMenuItem[]
}

export interface ContextMenuItem {
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  onSelect: () => void
}

export const $contextMenu = atom<ContextMenuState | null>(null)

export function openContextMenu(state: ContextMenuState): void {
  $contextMenu.set(state)
}

export function closeContextMenu(): void {
  $contextMenu.set(null)
}

export function openSessionContextMenu(x: number, y: number, sessionId: string, items: ContextMenuItem[]): void {
  $contextMenu.set({ x, y, kind: 'session', sessionId, items })
}

export function openMessageContextMenu(x: number, y: number, messageId: string, items: ContextMenuItem[]): void {
  $contextMenu.set({ x, y, kind: 'message', messageId, items })
}

export function openFileContextMenu(x: number, y: number, filePath: string, items: ContextMenuItem[]): void {
  $contextMenu.set({ x, y, kind: 'file', filePath, items })
}
