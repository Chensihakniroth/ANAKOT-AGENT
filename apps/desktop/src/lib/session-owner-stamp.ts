import { atom } from 'nanostores'
// Session owner stamp — ported from Hermes
export interface SessionOwnerStamp { sessionId: string; ownerId: string; timestamp: number }
export const $sessionOwnerStamps = atom<SessionOwnerStamp[]>([])