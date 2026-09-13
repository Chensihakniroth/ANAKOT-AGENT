import { persistentAtom } from '@/lib/persisted'
import { gatewayRpc } from '@/lib/gateway-rpc'

// Cron jobs — ported from Hermes with real gateway integration
export interface CronJob {
  id: string
  name: string
  schedule: string
  enabled: boolean
  last_run?: number
  next_run?: number
  prompt?: string
}

export const $cronJobs = persistentAtom<CronJob[]>('anakot.desktop.cron-jobs', [], {
  decode: (raw) => JSON.parse(raw),
  encode: (v) => JSON.stringify(v)
})

export async function loadCronJobs(): Promise<CronJob[]> {
  try {
    const result = await gatewayRpc<{ jobs?: CronJob[] }>('cron.list')
    const jobs = result.jobs || []
    $cronJobs.set(jobs)
    return jobs
  } catch {
    return $cronJobs.get()
  }
}

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

export async function createCronJob(name: string, schedule: string, prompt: string): Promise<CronJob | null> {
  try {
    const result = await gatewayRpc<{ job?: CronJob }>('cron.create', { name, schedule, prompt })
    if (result.job) {
      addCronJob(result.job)
      return result.job
    }
  } catch {
    // Ignore
  }
  return null
}

export async function deleteCronJob(id: string): Promise<boolean> {
  try {
    await gatewayRpc('cron.delete', { id })
    removeCronJob(id)
    return true
  } catch {
    return false
  }
}
