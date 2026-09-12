// Goal tracking — user-defined goals visible in the sidebar.
// Each goal has a title, done state, and optional linked session.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.goals'

export interface Goal {
  id: string
  title: string
  done: boolean
  sessionId?: string
  createdAt: number
}

function load(): Goal[] {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Goal[]) : []
  } catch {
    return []
  }
}

export const $goals = atom<Goal[]>(load())

$goals.subscribe(value => persistString(STORAGE_KEY, JSON.stringify(value)))

export function addGoal(title: string): void {
  const goal: Goal = {
    id: crypto.randomUUID(),
    title,
    done: false,
    createdAt: Date.now(),
  }
  $goals.set([...$goals.get(), goal])
}

export function toggleGoal(id: string): void {
  $goals.set($goals.get().map(g => (g.id === id ? { ...g, done: !g.done } : g)))
}

export function removeGoal(id: string): void {
  $goals.set($goals.get().filter(g => g.id !== id))
}

export function updateGoal(id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>): void {
  $goals.set($goals.get().map(g => (g.id === id ? { ...g, ...patch } : g)))
}
