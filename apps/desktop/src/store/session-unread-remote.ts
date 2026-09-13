import { atom } from 'nanostores'
// Session unread remote — ported from Hermes
export const $sessionUnreadRemote = atom<Record<string, number>>({})