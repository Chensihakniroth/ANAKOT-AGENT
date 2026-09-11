import { atom } from 'nanostores'

export interface PoolLimits {
  maxBackends: number
  idleMs: number
}

export interface PoolLimitsBounds {
  maxBackendsMax: number
  idleMsMax: number
}

export const $poolLimits = atom<PoolLimits | null>(null)
export const $poolLimitsBounds = atom<PoolLimitsBounds | null>(null)
export const $poolLimitsDefaults = atom<PoolLimits | null>(null)
export const $poolLimitsLoading = atom(true)

export async function loadPoolLimits(): Promise<void> {
  $poolLimitsLoading.set(true)
  try {
    const result = await window.anakotDesktop?.poolLimits?.get()
    if (result?.ok) {
      $poolLimits.set(result.limits)
      $poolLimitsBounds.set(result.bounds)
      $poolLimitsDefaults.set(result.defaults)
    }
  } catch {
    // Use defaults
  } finally {
    $poolLimitsLoading.set(false)
  }
}

export async function savePoolLimits(limits: Partial<PoolLimits>): Promise<boolean> {
  try {
    const result = await window.anakotDesktop?.poolLimits?.set(limits)
    if (result?.ok) {
      $poolLimits.set(result.limits)
      return true
    }
    return false
  } catch {
    return false
  }
}
