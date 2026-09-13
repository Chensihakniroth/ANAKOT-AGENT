import { atom } from 'nanostores'
export interface HubAction { id: string; label: string; run: () => void }
export const $hubActions = atom<HubAction[]>([])