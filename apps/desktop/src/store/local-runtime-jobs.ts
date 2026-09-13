import { atom } from 'nanostores'
export interface LocalRuntimeJob { id: string; status: string }
export const $localRuntimeJobs = atom<LocalRuntimeJob[]>([])