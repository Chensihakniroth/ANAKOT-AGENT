import { atom } from 'nanostores'
// Personalities — ported from Hermes
export interface Personality { id: string; name: string; description: string }
export const $personalities = atom<Personality[]>([])
export const $activePersonality = atom<Personality | null>(null)
export function setActivePersonality(id: string) {
  const p = $personalities.get().find(x => x.id === id) ?? null
  $activePersonality.set(p)
}