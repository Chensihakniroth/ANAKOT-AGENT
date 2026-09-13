import { atom } from 'nanostores'
// Model picker owner — ported from Hermes
export const $modelPickerOwner = atom<string | null>(null)