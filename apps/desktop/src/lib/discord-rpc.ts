/**
 * Discord Rich Presence service for the renderer.
 *
 * Provides a hook and helpers to manage Discord RPC from the React side:
 * - Auto-initializes presence when the app opens
 * - Allows updating presence with session/model info
 * - Exposes config get/set via IPC
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { DiscordRpcActivity, DiscordRpcConfig } from '@/global'

const DEFAULT_ACTIVITY: DiscordRpcActivity = {
  details: 'Chatting with Anakot',
  largeImageKey: 'anakot_logo',
  largeImageText: 'Anakot Agent',
  startTimestamp: Date.now(),
  instance: false,
}

// ── Config ──────────────────────────────────────────────────────────────

/** Fetch the current Discord RPC config from the main process. */
export async function getDiscordRpcConfig(): Promise<DiscordRpcConfig> {
  const api = window.anakotDesktop?.discordRpc
  if (!api) return { enabled: false, clientId: '' }
  return api.getConfig()
}

/** Update Discord RPC config (enabled / clientId) via the main process. */
export async function updateDiscordRpcConfig(
  patch: Partial<DiscordRpcConfig>,
): Promise<{ ok: boolean; reason?: string }> {
  const api = window.anakotDesktop?.discordRpc
  if (!api) return { ok: false, reason: 'no IPC bridge' }
  return api.updateConfig(patch)
}

// ── Activity ────────────────────────────────────────────────────────────

/** Set the current Discord Rich Presence activity. */
export async function setDiscordActivity(
  activity: DiscordRpcActivity,
): Promise<{ ok: boolean; reason?: string }> {
  const api = window.anakotDesktop?.discordRpc
  if (!api) return { ok: false, reason: 'no IPC bridge' }
  return api.setActivity(activity)
}

/** Clear the current activity (show as idle/not playing). */
export async function clearDiscordActivity(): Promise<{ ok: boolean; reason?: string }> {
  const api = window.anakotDesktop?.discordRpc
  if (!api) return { ok: false, reason: 'no IPC bridge' }
  return api.clearActivity()
}

/** Build a default activity with optional overrides. */
export async function buildDefaultDiscordActivity(
  opts?: Partial<DiscordRpcActivity>,
): Promise<DiscordRpcActivity> {
  const api = window.anakotDesktop?.discordRpc
  if (!api) return { ...DEFAULT_ACTIVITY, ...opts, startTimestamp: Date.now() }
  return api.buildDefaultActivity(opts)
}

// ── React Hook ──────────────────────────────────────────────────────────

/**
 * Hook that manages Discord Rich Presence for the app lifecycle.
 *
 * - Sets a default "Using Anakot Agent" presence on mount
 * - Accepts updates to details/state as the user interacts
 * - Clears activity on unmount
 * - Only works in Electron (no-op on web)
 *
 * @example
 * ```tsx
 * function AppShell() {
 *   useDiscordRpc({ details: 'Chatting', state: 'Session: test' })
 *   return <div>...</div>
 * }
 * ```
 */
export function useDiscordRpc(options?: {
  details?: string
  state?: string
  startTimestamp?: number
}) {
  const initializedRef = useRef(false)
  const currentActivity = useRef<DiscordRpcActivity | null>(null)

  // Set initial presence on mount
  useEffect(() => {
    // Only run in Electron
    if (!window.anakotDesktop?.discordRpc) return

    const activity: DiscordRpcActivity = {
      ...DEFAULT_ACTIVITY,
      ...(options?.details ? { details: options.details } : {}),
      ...(options?.state ? { state: options.state } : {}),
      startTimestamp: options?.startTimestamp ?? Date.now(),
    }

    currentActivity.current = activity
    initializedRef.current = true

    window.anakotDesktop.discordRpc.setActivity(activity).catch((err) => {
      console.warn('[discord-rpc] setActivity failed:', err?.message || err)
    })

    return () => {
      // Clear on unmount
      window.anakotDesktop?.discordRpc?.clearActivity().catch((err) => {
        console.warn('[discord-rpc] clearActivity failed:', err?.message || err)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update activity when options change
  useEffect(() => {
    if (!initializedRef.current) return
    if (!window.anakotDesktop?.discordRpc) return

    const activity: DiscordRpcActivity = {
      ...DEFAULT_ACTIVITY,
      ...(options?.details ? { details: options.details } : {}),
      ...(options?.state ? { state: options.state } : {}),
      ...(options?.startTimestamp ? { startTimestamp: options.startTimestamp } : {}),
    }

    currentActivity.current = activity
    window.anakotDesktop.discordRpc.setActivity(activity).catch((err) => {
      console.warn('[discord-rpc] setActivity (update) failed:', err?.message || err)
    })
  }, [options?.details, options?.state, options?.startTimestamp])
}

/**
 * Hook that provides imperative control over Discord RPC.
 * Use this when you need fine-grained control (e.g., button handlers).
 */
export function useDiscordRpcControl() {
  const setActivity = useCallback(async (activity: DiscordRpcActivity) => {
    return setDiscordActivity(activity)
  }, [])

  const clearActivity = useCallback(async () => {
    return clearDiscordActivity()
  }, [])

  const getConfig = useCallback(async () => {
    return getDiscordRpcConfig()
  }, [])

  const updateConfig = useCallback(async (patch: Partial<DiscordRpcConfig>) => {
    return updateDiscordRpcConfig(patch)
  }, [])

  return { clearActivity, getConfig, setActivity, updateConfig }
}

// ── Connection Status ────────────────────────────────────────────────────

export interface DiscordRpcStatus {
  connected: boolean
  user: { username: string; discriminator: string; avatar: string | null } | null
  error: string | null
}

/**
 * Hook that polls the Discord RPC connection status every 5 seconds.
 * Returns the current status and a refresh() function.
 */
export function useDiscordRpcStatus(): { status: DiscordRpcStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<DiscordRpcStatus | null>(null)

  const refresh = useCallback(async () => {
    const api = window.anakotDesktop?.discordRpc
    if (!api?.getConnectionStatus) {
      setStatus(null)
      return
    }
    try {
      const s = await api.getConnectionStatus()
      if (s && !s.connected && s.error) {
        console.warn('[discord-rpc] status:', s.error)
      }
      setStatus(s)
    } catch {
      setStatus(null)
    }
  }, [])

  // Poll on mount and every 5s
  useEffect(() => {
    // Only run in Electron
    if (!window.anakotDesktop?.discordRpc?.getConnectionStatus) return

    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return { status, refresh }
}
