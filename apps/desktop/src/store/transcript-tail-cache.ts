import { atom } from 'nanostores'
// Transcript tail cache — ported from Hermes
export const $transcriptTailCache = atom<Record<string, { messages: unknown[]; timestamp: number }>>({})