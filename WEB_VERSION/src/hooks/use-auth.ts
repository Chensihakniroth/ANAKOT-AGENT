import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/web-anakot-desktop'

export interface AuthProvider {
  name: string
  display_name: string
  supports_password: boolean
}

export interface AuthSession {
  user_id: string
  email?: string
  display_name?: string
  org_id?: string
  provider: string
  expires_at: number
}

export interface AuthState {
  /** Whether the server requires authentication at all */
  authRequired: boolean
  /** Whether the user has a valid session */
  isAuthenticated: boolean
  /** True while checking session on mount */
  loading: boolean
  /** Available login providers */
  providers: AuthProvider[]
  /** True while fetching providers */
  providersLoading: boolean
  /** Current session info, or null */
  user: AuthSession | null
  /** Error message, if any */
  error: string | null
}

/** Response from the password-login POST endpoint. */
interface PasswordLoginResponse {
  ok: boolean
  next: string
}

function readAuthRequiredFromWindow(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as Record<string, unknown>).__ANAKOT_AUTH_REQUIRED__
}

function readBasePath(): string {
  if (typeof window === 'undefined') return ''
  const bp = (window as unknown as Record<string, unknown>).__ANAKOT_BASE_PATH__ as string | undefined
  return bp && bp.startsWith('/') ? bp : ''
}

/**
 * Hook that reads the server-injected auth flags, checks session status,
 * and provides login/logout actions.
 *
 * When `authRequired` is false (loopback / `--insecure` mode), skips all
 * API calls and immediately reports `isAuthenticated = true` so the app
 * renders without a login gate.
 */
export function useAuth(): AuthState & {
  login: (providerName: string) => void
  passwordLogin: (providerName: string, username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  retry: () => void
} {
  const authRequired = readAuthRequiredFromWindow()

  const [loading, setLoading] = useState(authRequired)
  const [providersLoading, setProvidersLoading] = useState(authRequired)
  const [isAuthenticated, setIsAuthenticated] = useState(!authRequired)
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [user, setUser] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  const basePath = readBasePath()

  const checkSession = useCallback(async () => {
    if (!authRequired) {
      setLoading(false)
      setIsAuthenticated(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const session = await api<AuthSession>({ path: '/api/auth/me' })
      setUser(session)
      setIsAuthenticated(true)
    } catch {
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [authRequired])

  const loadProviders = useCallback(async () => {
    if (!authRequired) {
      setProviders([])
      setProvidersLoading(false)
      return
    }

    setProvidersLoading(true)
    try {
      const data = await api<{ providers: AuthProvider[] }>({ path: '/api/auth/providers' })
      setProviders(data.providers)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load login options'
      setError(message)
      setProviders([])
    } finally {
      setProvidersLoading(false)
    }
  }, [authRequired])

  useEffect(() => {
    checkSession()
    loadProviders()
  }, [checkSession, loadProviders])

  const login = useCallback(
    (providerName: string) => {
      const next = encodeURIComponent(window.location.pathname + window.location.hash)
      const url = `${basePath}/auth/login?provider=${encodeURIComponent(providerName)}&next=${next}`
      window.location.href = url
    },
    [basePath],
  )

  const logout = useCallback(async () => {
    try {
      await fetch(`${basePath}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Best-effort — reload regardless
    }
    window.location.reload()
  }, [basePath])

  const retry = useCallback(() => {
    checkSession()
    loadProviders()
  }, [checkSession, loadProviders])

  const passwordLogin = useCallback(
    async (providerName: string, username: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch(`${basePath}/auth/password-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ provider: providerName, username, password }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.detail || 'Invalid credentials')
          return false
        }
        // Session cookies are now set — re-check
        await checkSession()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        setError(message)
        return false
      }
    },
    [basePath, checkSession],
  )

  return {
    authRequired,
    isAuthenticated,
    loading,
    providers,
    providersLoading,
    user,
    error,
    login,
    passwordLogin,
    logout,
    retry,
  }
}
