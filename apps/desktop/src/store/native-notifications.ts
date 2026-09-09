import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

/**
 * Native notification kinds supported by the Electron backend.
 * These map to the defaults in main.cjs:
 *   { message: true, task_complete: true, update: true, error: true, info: true }
 */
export const NATIVE_NOTIFICATION_KINDS = ['message', 'task_complete', 'update', 'error', 'info'] as const
export type NativeNotificationKind = (typeof NATIVE_NOTIFICATION_KINDS)[number]

const NOTIFICATION_KIND_LABELS: Record<NativeNotificationKind, string> = {
  message: 'New Messages',
  task_complete: 'Task Complete',
  update: 'Updates',
  error: 'Errors',
  info: 'Info'
}

const NOTIFICATION_KIND_DESCRIPTIONS: Record<NativeNotificationKind, string> = {
  message: 'When the assistant sends a new message in a background session.',
  task_complete: 'When a background task or delegated subtask finishes.',
  update: 'When an app update is available or has been applied.',
  error: 'When an agent turn or tool call fails with an error.',
  info: 'General informational notifications and system messages.'
}

export function notificationKindLabel(kind: NativeNotificationKind): string {
  return NOTIFICATION_KIND_LABELS[kind]
}

export function notificationKindDescription(kind: NativeNotificationKind): string {
  return NOTIFICATION_KIND_DESCRIPTIONS[kind]
}

const MASTER_KEY = 'anakot.desktop.nativeNotificationsEnabled'

/** Master toggle — when off, no native notifications fire regardless of per-kind prefs. */
export const $nativeNotificationsEnabled = atom(storedBoolean(MASTER_KEY, true))

$nativeNotificationsEnabled.subscribe(enabled => {
  persistBoolean(MASTER_KEY, enabled)
})

export function setNativeNotificationsEnabled(enabled: boolean): void {
  $nativeNotificationsEnabled.set(enabled)
}

/** Per-kind notification prefs, loaded from the Electron backend. */
export const $nativeNotifyPrefs = atom<Record<NativeNotificationKind, boolean>>({
  message: true,
  task_complete: true,
  update: true,
  error: true,
  info: true
})

/** Load per-kind prefs from the Electron backend. */
export async function loadNativeNotifyPrefs(): Promise<void> {
  try {
    const prefs = await window.anakotDesktop?.getNotificationPrefs?.()
    if (prefs && typeof prefs === 'object') {
      const mapped: Partial<Record<NativeNotificationKind, boolean>> = {}
      for (const kind of NATIVE_NOTIFICATION_KINDS) {
        if (typeof prefs[kind] === 'boolean') {
          mapped[kind] = prefs[kind]
        }
      }
      if (Object.keys(mapped).length > 0) {
        $nativeNotifyPrefs.set({ ...$nativeNotifyPrefs.get(), ...mapped } as Record<NativeNotificationKind, boolean>)
      }
    }
  } catch {
    // Backend unavailable — keep defaults.
  }
}

/** Toggle a single notification kind and persist via IPC. */
export async function setNativeNotifyKind(kind: NativeNotificationKind, enabled: boolean): Promise<void> {
  const next = { ...$nativeNotifyPrefs.get(), [kind]: enabled }
  $nativeNotifyPrefs.set(next)

  try {
    await window.anakotDesktop?.setNotificationPrefs?.(next)
  } catch {
    // Best-effort persistence.
  }
}

/** Reset all notification prefs to defaults. */
export async function resetNativeNotifyPrefs(): Promise<void> {
  const defaults: Record<NativeNotificationKind, boolean> = {
    message: true,
    task_complete: true,
    update: true,
    error: true,
    info: true
  }
  $nativeNotifyPrefs.set(defaults)

  try {
    await window.anakotDesktop?.setNotificationPrefs?.(defaults)
  } catch {
    // Best-effort.
  }
}

/**
 * Map from Hermes/event dispatch kinds to the backend's native-notification pref keys.
 * This lets the user's per-kind preferences gate every notification source.
 */
const KIND_TO_BACKEND: Record<string, string> = {
  approval: 'message',
  input: 'message',
  turnDone: 'task_complete',
  turnError: 'error'
}

/**
 * Throttle state — tracks last-fire timestamp per `kind:sessionId` key.
 * Prevents rapid-fire duplicates within 1 second.
 */
const lastFired = new Map<string, number>()
const THROTTLE_MS = 1_000

/**
 * Dispatch a native OS notification, subject to the user's master toggle and
 * per-kind preferences.
 *
 * The `kind` field is used to look up the closest backend pref key. Unknown
 * kinds (or unmapped ones) default to `'info'`.
 *
 * Returns `true` if the notification was dispatched, `false` if it was
 * suppressed (disabled, throttled, or no bridge available).
 */
export function dispatchNativeNotification(payload: {
  kind: string
  title: string
  body: string
  sessionId?: string | null
}): boolean {
  // Master toggle check
  if (!$nativeNotificationsEnabled.get()) return false

  const { kind, title, body, sessionId } = payload

  // Per-kind pref check via backend key
  const backendKey = KIND_TO_BACKEND[kind] ?? 'info'
  const prefs = $nativeNotifyPrefs.get()
  // Map the backend key back to our NativeNotificationKind for the prefs check
  const mappedKind = (Object.keys(prefs) as NativeNotificationKind[]).find(k => k === backendKey)
  if (mappedKind && !prefs[mappedKind]) return false

  // Throttle: 1-second dedup per kind:sessionId
  const throttleKey = `${kind}:${sessionId ?? ''}`
  const now = Date.now()
  const last = lastFired.get(throttleKey)
  if (last && now - last < THROTTLE_MS) return false
  lastFired.set(throttleKey, now)

  // Fire via the Electron bridge
  try {
    window.anakotDesktop?.notify?.({ title, body, kind: backendKey })
    return true
  } catch {
    return false
  }
}