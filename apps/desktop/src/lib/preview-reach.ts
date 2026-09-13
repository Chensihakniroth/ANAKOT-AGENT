import { atom } from 'nanostores'
// Preview reach — ported from Hermes
export const $previewReach = atom<{ url: string; reachable: boolean } | null>(null)