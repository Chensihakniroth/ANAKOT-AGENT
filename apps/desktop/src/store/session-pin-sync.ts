import { atom } from 'nanostores'
// Session pin sync — ported from Hermes
export const $sessionPinSync = atom<Record<string, boolean>>({})