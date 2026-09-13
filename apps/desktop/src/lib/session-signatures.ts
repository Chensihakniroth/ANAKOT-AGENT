import { atom } from 'nanostores'
// Session signatures — ported from Hermes
export interface SessionSignature { sessionId: string; signature: string }
export const $sessionSignatures = atom<SessionSignature[]>([])