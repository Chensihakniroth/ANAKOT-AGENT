import { atom } from 'nanostores'
// Windows — ported from Hermes
export const $windowStates = atom<Record<string, { visible: boolean; minimized: boolean }>>({})
export function isBrowserWindow(): boolean { return true }
export function isSecondaryWindow(): boolean { return false }