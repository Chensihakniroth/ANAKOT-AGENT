// Active work tracking — the current task the agent is executing.
// Surfaces progress in the sidebar / HUD.

import { atom } from 'nanostores'

export interface ActiveWork {
  id: string
  sessionId: string
  label: string
  status: 'running' | 'done' | 'error'
  progress?: number
  startedAt: number
}

export const $activeWork = atom<ActiveWork[]>([])

export function startWork(sessionId: string, label: string): string {
  const id = crypto.randomUUID()
  $activeWork.set([
    ...$activeWork.get(),
    { id, sessionId, label, status: 'running', startedAt: Date.now() },
  ])
  return id
}

export function updateWork(id: string, patch: Partial<Omit<ActiveWork, 'id'>>): void {
  $activeWork.set($activeWork.get().map(w => (w.id === id ? { ...w, ...patch } : w)))
}

export function completeWork(id: string): void {
  updateWork(id, { status: 'done' })
}

export function failWork(id: string): void {
  updateWork(id, { status: 'error' })
}

export function clearWork(id: string): void {
  $activeWork.set($activeWork.get().filter(w => w.id !== id))
}

export function clearSessionWork(sessionId: string): void {
  $activeWork.set($activeWork.get().filter(w => w.sessionId !== sessionId))
}
