import { atom } from 'nanostores'
// Tips — ported from Hermes
export interface Tip { id: string; content: string; dismissed: boolean }
export const $tips = atom<Tip[]>([])
export function dismissTip(id: string) { $tips.set($tips.get().map(t => t.id === id ? { ...t, dismissed: true } : t)) }