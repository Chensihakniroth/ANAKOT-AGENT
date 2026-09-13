import { atom } from 'nanostores'

import { persistStringRecord, storedStringRecord } from '@/lib/storage'

import type { ComposerAttachment } from './composer'

// Composer message queue — ported from Hermes
// Manages queued prompts per session with persistence

const STORAGE_KEY = 'anakot.desktop.composer-queue.v1'

export interface QueuedPromptEntry {
  id: string
  text: string
  attachments: ComposerAttachment[]
  createdAt: number
  sessionId?: string | null
}

interface QueueState {
  [sessionId: string]: QueuedPromptEntry[]
}

function load(): QueueState {
  return storedStringRecord(STORAGE_KEY) as unknown as QueueState
}

function save(state: QueueState): void {
  persistStringRecord(STORAGE_KEY, state as unknown as Record<string, string>)
}

export const $queuedPromptsBySession = atom<QueueState>(load())
export const $parkedQueueSessions = atom<Record<string, true>>({})

$queuedPromptsBySession.subscribe(save)

export const isSteerableEntry = (entry: Pick<QueuedPromptEntry, 'attachments' | 'text'>): boolean => {
  return Boolean(entry.text?.trim() || entry.attachments?.length)
}

export const getQueuedPrompts = (key: string | null | undefined): QueuedPromptEntry[] => {
  if (!key) return []
  return $queuedPromptsBySession.get()[key] ?? []
}

export const enqueueQueuedPrompt = (
  key: string | null | undefined,
  entry: Omit<QueuedPromptEntry, 'id' | 'createdAt'> & { id?: string }
): QueuedPromptEntry | null => {
  if (!key) return null
  const id = entry.id ?? crypto.randomUUID()
  const full: QueuedPromptEntry = { ...entry, id, createdAt: Date.now(), sessionId: key }
  const current = $queuedPromptsBySession.get()
  $queuedPromptsBySession.set({
    ...current,
    [key]: [...(current[key] ?? []), full],
  })
  return full
}

export const dequeueQueuedPrompt = (key: string | null | undefined): null | QueuedPromptEntry => {
  if (!key) return []
  const current = $queuedPromptsBySession.get()
  const queue = current[key] ?? []
  if (queue.length === 0) return null
  const [next, ...rest] = queue
  $queuedPromptsBySession.set({ ...current, [key]: rest })
  return next
}

export const removeQueuedPrompt = (key: string | null | undefined, id: string): boolean => {
  if (!key) return false
  const current = $queuedPromptsBySession.get()
  const queue = current[key] ?? []
  const next = queue.filter(e => e.id !== id)
  if (next.length === queue.length) return false
  $queuedPromptsBySession.set({ ...current, [key]: next })
  return true
}

export const promoteQueuedPrompt = (key: string | null | undefined, id: string): boolean => {
  if (!key) return false
  const current = $queuedPromptsBySession.get()
  const queue = current[key] ?? []
  const index = queue.findIndex(e => e.id === id)
  if (index <= 0) return false
  const [entry] = queue.splice(index, 1)
  queue.unshift(entry)
  $queuedPromptsBySession.set({ ...current, [key]: [...queue] })
  return true
}

export const updateQueuedPrompt = (
  key: string | null | undefined,
  id: string,
  patch: Partial<QueuedPromptEntry>
): boolean => {
  if (!key) return false
  const current = $queuedPromptsBySession.get()
  const queue = current[key] ?? []
  const index = queue.findIndex(e => e.id === id)
  if (index < 0) return false
  queue[index] = { ...queue[index], ...patch }
  $queuedPromptsBySession.set({ ...current, [key]: [...queue] })
  return true
}

export const updateQueuedPromptText = (key: string | null | undefined, id: string, text: string): boolean =>
  updateQueuedPrompt(key, id, { text })

export const clearQueuedPrompts = (key: string | null | undefined) => {
  if (!key) return
  const current = $queuedPromptsBySession.get()
  $queuedPromptsBySession.set({ ...current, [key]: [] })
}

export const migrateQueuedPrompts = (fromKey: string | null | undefined, toKey: string | null | undefined): boolean => {
  if (!fromKey || !toKey || fromKey === toKey) return false
  const current = $queuedPromptsBySession.get()
  const from = current[fromKey] ?? []
  if (from.length === 0) return false
  $queuedPromptsBySession.set({
    ...current,
    [fromKey]: [],
    [toKey]: [...(current[toKey] ?? []), ...from],
  })
  return true
}

export const parkQueuedPrompts = (key: string | null | undefined): boolean => {
  if (!key) return false
  const current = $queuedPromptsBySession.get()
  if ((current[key] ?? []).length === 0) return false
  $parkedQueueSessions.set({ ...$parkedQueueSessions.get(), [key]: true })
  return true
}

export const unparkQueuedPrompts = (key: string | null | undefined): void => {
  if (!key) return
  const current = { ...$parkedQueueSessions.get() }
  delete current[key]
  $parkedQueueSessions.set(current)
}

export const isQueueParked = (key: string | null | undefined): boolean => {
  if (!key) return false
  return $parkedQueueSessions.get()[key] === true
}

export interface AutoDrainInput {
  isBusy: boolean
  parked: boolean
  queueLength: number
}

export const shouldAutoDrain = ({ isBusy, parked, queueLength }: AutoDrainInput): boolean => {
  return !isBusy && !parked && queueLength > 0
}

export const shouldAutoDrainOnSettle = (): boolean => {
  return shouldAutoDrain({
    isBusy: false,
    parked: false,
    queueLength: Object.values($queuedPromptsBySession.get()).reduce((sum, q) => sum + q.length, 0),
  })
}

export const MAX_AUTO_DRAIN_ATTEMPTS = 4
