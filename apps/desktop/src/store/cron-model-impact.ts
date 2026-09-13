import { atom } from 'nanostores'
export const $cronModelImpact = atom<Record<string, { lastRun: number }>>({})