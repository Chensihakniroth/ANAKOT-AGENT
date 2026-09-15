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
// Whether the managed-update overlay is open. Kept as an atom so the overlay
// component can self-hide like every other overlay in the shell (the Hermes
// port this was taken from had no open-state and rendered full-height,
// covering the entire app shell).
export const $updateOverlayOpen = atom<boolean>(false)

// Update notification cooldown tracking (stored in atom for test isolation)
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours
export const $updateNotificationState = atom<{
  lastDismissedSha: string | null
  lastDismissedAt: number
}>({ lastDismissedSha: null, lastDismissedAt: 0 })

let pollerTimer: ReturnType<typeof setInterval> | null = null

/**
 * Check for updates by querying the backend update check endpoint.
 * Returns whether the app is behind upstream and how many commits.
 */
export async function checkForUpdates(): Promise<void> {
  $updateChecking.set(true)
  try {
    const desktop = (window as any).anakotDesktop
    if (!desktop) {
      $managedUpdates.set({ available: false, error: 'Desktop bridge unavailable' })
      return
    }

    // Use the dedicated update check endpoint (caches for 6h on backend)
    const result = await desktop.api({ path: '/api/anakot/update/check' })
    const behind = result.behind ?? 0
    const canApply = result.can_apply ?? false
    const updateAvailable = behind > 0

    $desktopVersion.set({ appVersion: result.current_version, fetchedAt: Date.now() })

    if (updateAvailable) {
      $managedUpdates.set({
        available: true,
        behind,
        appVersion: result.current_version,
        supported: canApply,
        fetchedAt: Date.now(),
        message: canApply
          ? `${behind} update${behind === 1 ? '' : 's'} available`
          : result.message || 'Update available — manual install required',
      })
    } else {
      $managedUpdates.set({
        available: false,
        appVersion: result.current_version,
        fetchedAt: Date.now(),
        message: 'Up to date',
      })
    }

    $updateStatus.set($managedUpdates.get())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    $managedUpdates.set({ available: false, error: message })
  } finally {
    $updateChecking.set(false)
  }
}

/**
 * Trigger the update process. In desktop mode, this runs `anakot update` via IPC.
 */
export async function installUpdate(): Promise<void> {
  $managedUpdates.set({ ...$managedUpdates.get(), downloading: true })
  $updateApply.set({ status: 'applying', applying: true, stage: 'starting', message: 'Starting update...' })

  try {
    const desktop = (window as any).anakotDesktop
    if (!desktop) {
      $updateApply.set({ status: 'error', message: 'Desktop bridge unavailable' })
      return
    }

    // Trigger update via IPC — the backend handles the actual update process
    await desktop.api({ path: '/api/anakot/update', method: 'POST' })

    $updateApply.set({ status: 'done', applying: false, stage: 'complete', message: 'Update started — app will restart' })
    $managedUpdates.set({ ...$managedUpdates.get(), downloading: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    $updateApply.set({ status: 'error', applying: false, message })
    $managedUpdates.set({ ...$managedUpdates.get(), downloading: false, error: message })
  }
}

export function openUpdatesWindow(): void {
  $updateOverlayOpen.set(true)
}

export function startUpdatePoller(intervalMs = 60 * 60 * 1000): void {
  if (pollerTimer) return // Already running
  // Check immediately, then on interval
  void checkForUpdates()
  pollerTimer = setInterval(() => {
    void checkForUpdates()
    maybeNotifyUpdateAvailable()
  }, intervalMs)
}

export function stopUpdatePoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer)
    pollerTimer = null
  }
}

export function reportBackendContract(_contract?: unknown): void {
  // Stub: report backend contract — used by Hermes for update compatibility checks
}

export function checkUpdates(): void {
  void checkForUpdates()
}

export function refreshDesktopVersion(): void {
  void checkForUpdates()
}

export function setUpdateOverlayOpen(open: boolean): void {
  $updateOverlayOpen.set(open)
}

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
