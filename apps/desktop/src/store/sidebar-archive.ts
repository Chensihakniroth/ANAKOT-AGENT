import { atom } from 'nanostores'
// Sidebar archive — ported from Hermes
export const $sidebarArchive = atom<Set<string>>(new Set())