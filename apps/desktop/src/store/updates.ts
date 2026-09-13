import { atom } from 'nanostores'

import { notify } from '@/store/notifications'

// Managed updates — ported from Hermes
export interface ManagedUpdateState {
  available: boolean
  version?: string
  downloading?: boolean
  progress?: number
  behind?: number
  supported?: boolean
  message?: string
  error?: string
  appVersion?: string
  fetchedAt?: number
  branch?: string
  currentSha?: string
}

export const $managedUpdates = atom<ManagedUpdateState>({ available: false })
export const $updateStatus = atom<ManagedUpdateState>({ available: false })
export const $updateChecking = atom<boolean>(false)
export const $desktopVersion = atom<{ appVersion?: string; fetchedAt?: number }>({})
export const $updateApply = atom<{ status: string; applying?: boolean; stage?: string; message?: string }>({ status: 'idle' })

// Update notification cooldown tracking (stored in atom for test isolation)
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours
export const $updateNotificationState = atom<{
  lastDismissedSha: string | null
  lastDismissedAt: number
}>({ lastDismissedSha: null, lastDismissedAt: 0 })

export async function checkForUpdates(): Promise<void> {
  $managedUpdates.set({ available: false })
}

export async function installUpdate(): Promise<void> {
  $managedUpdates.set({ ...$managedUpdates.get(), downloading: true })
}

export function openUpdatesWindow(): void {}
export function startUpdatePoller(): void {}
export function stopUpdatePoller(): void {}
export function reportBackendContract(): void {}
export function checkUpdates(): void {}
export function refreshDesktopVersion(): void {}
export function setUpdateOverlayOpen(_open: boolean): void {}

export function maybeNotifyUpdateAvailable(status?: { behind?: number; targetSha?: string; supported?: boolean }): void {
  // Do nothing if up to date or not supported
  if (!status || status.behind === 0 || status.supported === false) {
    // Reset cooldown state when up to date
    $updateNotificationState.set({ lastDismissedSha: null, lastDismissedAt: 0 })
    return
  }

  const { lastDismissedSha, lastDismissedAt } = $updateNotificationState.get()
  const now = Date.now()

  // If we've seen this commit before and we're still in cooldown, skip
  if (lastDismissedSha === status.targetSha && now - lastDismissedAt < COOLDOWN_MS) {
    return
  }

  // If a different commit arrived after dismiss, check cooldown
  if (lastDismissedSha !== null && lastDismissedSha !== status.targetSha && now - lastDismissedAt < COOLDOWN_MS) {
    return
  }

  // Notify
  notify({
    title: 'Update Available',
    message: `You are ${status.behind} commit${status.behind === 1 ? '' : 's'} behind`,
    onDismiss: () => {
      $updateNotificationState.set({ lastDismissedSha: status.targetSha ?? null, lastDismissedAt: Date.now() })
    },
  })
}

export { UpdatesOverlay } from '@/app/updates-overlay'
