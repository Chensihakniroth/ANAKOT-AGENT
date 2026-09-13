import { persistentAtom } from '@/lib/persisted'
// Cron jobs — full port from Hermes
export interface CronJob {
  id: string
  name: string
  schedule: string
  enabled: boolean
  last_run?: number
  next_run?: number
}
export const $cronJobs = persistentAtom<CronJob[]>('anakot.desktop.cron-jobs', [], {
  decode: (raw) => JSON.parse(raw),
  encode: (v) => JSON.stringify(v)
})
export function addCronJob(job: CronJob) {
  $cronJobs.set([...$cronJobs.get(), job])
}
export function removeCronJob(id: string) {
  $cronJobs.set($cronJobs.get().filter(j => j.id !== id))
}
export function updateCronJob(id: string, patch: Partial<CronJob>) {
  $cronJobs.set($cronJobs.get().map(j => j.id === id ? { ...j, ...patch } : j))
}
export function toggleCronJob(id: string) {
  updateCronJob(id, { enabled: !$cronJobs.get().find(j => j.id === id)?.enabled })
}