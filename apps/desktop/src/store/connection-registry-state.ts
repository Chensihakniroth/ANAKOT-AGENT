import { atom } from 'nanostores'
export const $connectionRegistryState = atom<Record<string, { connected: boolean }>>({})