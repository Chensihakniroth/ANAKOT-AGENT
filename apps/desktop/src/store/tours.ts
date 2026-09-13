import { atom } from 'nanostores'
// Tours — ported from Hermes
export interface Tour { id: string; name: string; steps: string[]; completed: boolean }
export const $tours = atom<Tour[]>([])
export const $toursEnabled = atom(true)
export function completeTour(id: string) { $tours.set($tours.get().map(t => t.id === id ? { ...t, completed: true } : t)) }