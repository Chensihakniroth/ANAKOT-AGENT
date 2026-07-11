/**
 * Web Landing Page — combined hero landing + login.
 *
 * Two modes depending on auth config:
 *   1) No auth required   → brand hero + "Get Started" → into the app
 *   2) Auth required       → brand hero + provider login buttons
 */
import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { ShaderBackground } from '@/components/ui/shader-background'
import { $gatewayState } from '@/store/session'
import type { AuthProvider } from '@/hooks/use-auth'

// ── Props ──────────────────────────────────────────────────────────────────────

interface WebLandingPageProps {
  authRequired?: boolean
  isAuthenticated?: boolean
  authLoading?: boolean
  providers?: AuthProvider[]
  providersLoading?: boolean
  authError?: string | null
  onLogin?: (providerName: string) => void
  onPasswordLogin?: (providerName: string, username: string, password: string) => Promise<boolean>
  onRetry?: () => void
}

// ── Feature cards ──────────────────────────────────────────────────────────────

interface Feature {
  icon: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  { icon: '\u2728', title: 'AI Chat', description: 'Multi-turn conversations with any model \u2014 Claude, GPT, Gemini, and more.' },
  { icon: '\uD83D\uDCAC', title: 'Sessions', description: 'Organise chats into sessions. Branch, fork, and revisit past conversations.' },
  { icon: '\u23F0', title: 'Cron', description: 'Schedule autonomous agent runs. Monitor, alert, and automate.' },
  { icon: '\u2709\uFE0F', title: 'Messaging', description: 'Connect Telegram, Discord, SMS. The agent messages you where you are.' },
  { icon: '\uD83D\uDCE6', title: 'Artifacts', description: 'Code previews, rendered documents, and live output from agent tools.' },
  { icon: '\uD83E\uDDE0', title: 'Skills', description: 'Extend the agent with custom skills, plugins, and knowledge graph.' },
]

// ── Provider icon (extracted from login-page) ──────────────────────────────────

function ProviderIcon({ name }: { name: string }) {
  const n = name.toLowerCase()

  if (n.includes('google')) {
    return (
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    )
  }

  if (n.includes('github') || n.includes('gitlab')) {
    return (
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    )
  }

  if (n.includes('microsoft') || n.includes('azure') || n.includes('entra') || n.includes('oidc')) {
    return (
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="9" height="9" fill="#F25022" />
        <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
        <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
        <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

// ── Password form (auth mode only) ─────────────────────────────────────────────

interface PasswordFormProps {
  providerName: string
  providerDisplayName: string
  onPasswordLogin: (providerName: string, username: string, password: string) => Promise<boolean>
}

function PasswordForm({ providerName, providerDisplayName, onPasswordLogin }: PasswordFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!username.trim() || !password) return
      setLoading(true)
      setError(null)
      try {
        const ok = await onPasswordLogin(providerName, username, password)
        if (!ok) setError('Invalid credentials')
      } catch {
        setError('Login failed')
      } finally {
        setLoading(false)
      }
    },
    [providerName, username, password, onPasswordLogin],
  )

  return (
    <div className="mt-5 w-full">
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.07]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#0b2942] px-2 text-[#637777]">or</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="landing-username" className="block text-sm font-medium text-[#637777] mb-1.5">
            Email or username
          </label>
          <input
            id="landing-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
            disabled={loading}
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-[#d6deeb] placeholder:text-[#637777] outline-none transition-colors focus:border-[#82aaff]/50 focus:ring-1 focus:ring-[#82aaff]/30 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="landing-password" className="block text-sm font-medium text-[#637777] mb-1.5">
            Password
          </label>
          <input
            id="landing-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            autoComplete="current-password"
            disabled={loading}
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-[#d6deeb] placeholder:text-[#637777] outline-none transition-colors focus:border-[#82aaff]/50 focus:ring-1 focus:ring-[#82aaff]/30 disabled:opacity-50"
          />
        </div>
        {error && <p className="text-sm text-[#ef5350] m-0">{error}</p>}
        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full cursor-pointer rounded-md bg-[#82aaff] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6b96e0] disabled:opacity-50"
        >
          {loading ? 'Signing in\u2026' : `Sign in with ${providerDisplayName}`}
        </button>
      </form>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WebLandingPage({
  authRequired,
  isAuthenticated,
  authLoading,
  providers = [],
  providersLoading,
  authError,
  onLogin,
  onPasswordLogin,
  onRetry,
}: WebLandingPageProps) {
  const gatewayState = useStore($gatewayState)
  const [dismissed, setDismissed] = useState(false)

  // Auto-dismiss if the gateway becomes open (backend started on its own)
  useEffect(() => {
    if (gatewayState === 'open' && !dismissed) {
      setDismissed(true)
    }
  }, [gatewayState, dismissed])

  // ALL hooks above — early return below is safe
  const handleGetStarted = useCallback(() => {
    setDismissed(true)
  }, [])

  const handleLogin = useCallback(
    (providerName: string) => {
      onLogin?.(providerName)
    },
    [onLogin],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, providerName: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleLogin(providerName)
      }
    },
    [handleLogin],
  )

  // Dismissed — remove from DOM
  if (dismissed) return null

  // ── Determine which CTA section to render ──
  const isAuthMode = authRequired && !isAuthenticated
  const isAuthLoading = authLoading || providersLoading

  // Separate password provider if in auth mode
  const passwordProvider = providers.find((p) => p.supports_password)
  const oauthProviders = providers.filter((p) => !p.supports_password)

  let ctaSection: React.ReactNode

  if (isAuthMode && isAuthLoading) {
    // Loading skeleton (auth mode)
    ctaSection = (
      <div className="flex w-full max-w-sm flex-col items-center gap-4" aria-label="Loading sign-in options">
        <div className="h-16 w-full rounded-xl bg-white/[0.06] animate-pulse" />
        <div className="h-16 w-full rounded-xl bg-white/[0.06] animate-pulse" />
      </div>
    )
  } else if (isAuthMode && authError && providers.length === 0) {
    // Error state (auth mode, no providers loaded)
    ctaSection = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-[#ef5350]">{authError}</p>
        <button
          onClick={onRetry}
          className="cursor-pointer rounded px-4 py-2 text-sm font-medium text-white bg-[#82aaff] hover:bg-[#6b96e0] transition-colors border-0"
        >
          Retry
        </button>
      </div>
    )
  } else if (isAuthMode && oauthProviders.length > 0) {
    // Provider login buttons
    ctaSection = (
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <h2 className="m-0 text-lg font-semibold text-[#d6deeb]">Sign in to continue</h2>
        <div className="grid w-full gap-3">
          {oauthProviders.map((p) => (
            <button
              key={p.name}
              onClick={() => handleLogin(p.name)}
              onKeyDown={(e) => handleKeyDown(e, p.name)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-[#d6deeb] transition-all duration-150 hover:bg-white/[0.08] hover:border-[#82aaff]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82aaff]/60 active:scale-[0.98]"
              aria-label={`Sign in with ${p.display_name}`}
            >
              <ProviderIcon name={p.name} />
              <span className="flex-1">
                Sign in with <strong>{p.display_name}</strong>
              </span>
              <svg className="size-4 text-[#637777] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
        {passwordProvider && onPasswordLogin && (
          <PasswordForm
            providerName={passwordProvider.name}
            providerDisplayName={passwordProvider.display_name}
            onPasswordLogin={onPasswordLogin}
          />
        )}
      </div>
    )
  } else if (isAuthMode && providers.length === 0 && !authLoading) {
    // Auth mode but no providers configured
    ctaSection = (
      <div className="text-center">
        <p className="text-sm text-[#637777] mb-1">No sign-in methods are configured.</p>
        <p className="text-xs text-[#637777]">Contact your administrator.</p>
      </div>
    )
  } else {
    // No auth required — simple "Get Started" CTA
    ctaSection = (
      <button
        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 min-w-[180px] rounded-xl bg-white/90 px-6 text-sm font-semibold text-[#011627] shadow-lg shadow-black/20 transition-all hover:bg-white hover:shadow-xl active:scale-[0.98]"
        onClick={handleGetStarted}
      >
        Get Started
      </button>
    )
  }

  // ── Determine footer text ──
  const footerText = isAuthMode ? 'Auth required \u00B7 Open source \u00B7 Self-hosted \u00B7 Private'
    : 'No account needed \u00B7 Open source \u00B7 Self-hosted \u00B7 Private'

  return (
    <div
      className="fixed inset-0 z-[1500] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#011627' }}
    >
      <ShaderBackground className="pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-6 py-12">
        {/* Hero */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-white/10 shadow-lg shadow-black/20">
            <BrandMark className="size-12" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Anakot Agent
          </h1>
          <p className="max-w-lg text-center text-base leading-relaxed text-white/60 sm:text-lg">
            {'Your AI agent platform \u2014 chat, automate, and orchestrate from anywhere. Open source, runs on your own infra.'}
          </p>
        </div>

        {/* CTA / Login section */}
        <div className="flex flex-col items-center">
          {ctaSection}
        </div>

        {/* Feature Grid */}
        <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.08]"
            >
              <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">{f.icon}</span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white/85">{f.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-white/50">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-xs text-white/30">{footerText}</p>
      </div>
    </div>
  )
}
