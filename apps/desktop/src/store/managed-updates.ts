import { atom } from 'nanostores'
export const $managedUpdates = atom<{ available: boolean; version?: string }>({ available: false })