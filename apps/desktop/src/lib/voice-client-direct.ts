import { atom } from 'nanostores'
// Voice client direct — ported from Hermes
export const $voiceClientDirect = atom<{ connected: boolean }>({ connected: false })