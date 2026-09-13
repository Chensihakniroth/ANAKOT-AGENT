import { atom } from 'nanostores'
// Session event provenance — ported from Hermes
export interface SessionEventProvenance { sessionId: string; eventId: string; source: string; timestamp: number }
export const $sessionEventProvenance = atom<SessionEventProvenance[]>([])