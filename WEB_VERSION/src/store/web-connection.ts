/**
 * Web-version connection configuration.
 *
 * Stores the backend URL in localStorage so friends can point the
 * frontend at any running Anakot backend without recompiling.
 */
import { atom } from 'nanostores'
import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.web.backend-url'
const DEFAULT_HOST = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5175'

export interface WebConnectionState {
  /** User-configured backend URL (protocol + host, e.g. http://192.168.1.42:7890) */
  backendUrl: string
  /** Whether a connection attempt is in flight */
  connecting: boolean
  /** Last error message, or null if not set */
  error: string | null
  /** True if the last test succeeded */
  connected: boolean
  /** The original host the frontend was served from (fallback target) */
  originHost: string
}

function loadBackendUrl(): string {
  const saved = storedString(STORAGE_KEY)
  if (saved) return saved
  // Derive default from window.location
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${protocol}//${DEFAULT_HOST}`
}

export function persistBackendUrl(url: string) {
  persistString(STORAGE_KEY, url)
}

export const $webConnection = atom<WebConnectionState>({
  backendUrl: loadBackendUrl(),
  connecting: false,
  error: null,
  connected: false,
  originHost: DEFAULT_HOST,
})

export function setWebBackendUrl(url: string) {
  const trimmed = url.replace(/\/+$/, '') // strip trailing slashes
  persistBackendUrl(trimmed)
  $webConnection.set({
    ...$webConnection.get(),
    backendUrl: trimmed,
    error: null,
    connected: false,
  })
}

export function setWebConnecting(connecting: boolean) {
  $webConnection.set({ ...$webConnection.get(), connecting })
}

export function setWebConnectionError(error: string | null) {
  $webConnection.set({ ...$webConnection.get(), error, connecting: false })
}

export function setWebConnected(connected: boolean) {
  $webConnection.set({ ...$webConnection.get(), connected, error: null, connecting: false })
}
