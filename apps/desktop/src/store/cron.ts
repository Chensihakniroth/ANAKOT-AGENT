import { atom } from 'nanostores'
// Cron jobs — ported from Hermes
export interface CronJob { id: string; name: string; schedule: string }
export const $cronJobs = atom<CronJob[]>([])
export function setCronJobs(jobs: CronJob[]) { $cronJobs.set(jobs) }