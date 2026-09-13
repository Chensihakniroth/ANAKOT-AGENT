import { atom } from 'nanostores'

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

export async function checkForUpdates(): Promise<void> {
  $managedUpdates.set({ available: false })
}

export async function installUpdate(): Promise<void> {
  $managedUpdates.set({ ...$managedUpdates.get(), downloading: true })
}

export function openUpdatesWindow(): void {}
export function startUpdatePoller(): void {}
export function stopUpdatePoller(): void {}
export function reportBackendContract(_contract?: unknown): void {}
export function checkUpdates(): void {}
export function refreshDesktopVersion(): void {}
export function setUpdateOverlayOpen(_open: boolean): void {}
export function maybeNotifyUpdateAvailable(_status?: unknown): void {}

export { UpdatesOverlay } from '@/app/updates-overlay'
