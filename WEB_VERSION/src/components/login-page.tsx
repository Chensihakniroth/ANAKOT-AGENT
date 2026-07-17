/**
 * Login Page — immersive, stylish auth page.
 *
 * Layered depth with animated ambient effects, geometric decor,
 * and a premium glass card. Pure Tailwind, no extra deps.
 */
import { useCallback, useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { ShaderBackground } from '@/components/ui/shader-background'
import type { AuthProvider } from '@/hooks/use-auth'

// ── Props ──────────────────────────────────────────────────────────────────────

interface LoginPageProps {
  authLoading?: boolean
  providers?: AuthProvider[]
  providersLoading?: boolean
  authError?: string | null
  onLogin?: (providerName: string) => void
  onPasswordLogin?: (providerName: string, username: string, password: string) => Promise<boolean>
  onRetry?: () => void
}

// ── Provider icons ─────────────────────────────────────────────────────────────

function GoogleIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GitHubIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function MicrosoftIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

function GenericProviderIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: AuthProvider }) {
  const n = (provider.name + ' ' + provider.display_name).toLowerCase()
  if (n.includes('google')) return <GoogleIcon className="size-[18px]" />
  if (n.includes('github') || n.includes('gitlab')) return <GitHubIcon className="size-[18px]" />
  if (n.includes('microsoft') || n.includes('azure') || n.includes('entra')) return <MicrosoftIcon className="size-[18px]" />
  // OIDC / generic OAuth providers render as Google — the user wants
  // the familiar Google-branded sign-in button for their OIDC provider.
  if (n.includes('oidc')) return <GoogleIcon className="size-[18px]" />
  return <GenericProviderIcon className="size-[18px]" />
}

// ── Google-branded button ──────────────────────────────────────────────────────

function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#1f1f1f] shadow-lg shadow-black/[0.15] transition-all duration-300 hover:bg-[#f8f9fa] hover:shadow-xl hover:shadow-black/[0.2] hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <GoogleIcon className="size-[18px]" />
      <span>Continue with Google</span>
    </button>
  )
}

// ── Standard OAuth button ──────────────────────────────────────────────────────

function OAuthButton({
  provider,
  onClick,
  onKeyDown,
}: {
  provider: AuthProvider
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  // Treat OIDC providers as Google for a branded sign-in experience.
  const isGoogle =
    provider.name.toLowerCase().includes('google') ||
    provider.name.toLowerCase().includes('oidc') ||
    provider.display_name.toLowerCase().includes('oidc')

  // Google gets its own branded button — the rest get a unified dark style.
  if (isGoogle) return <GoogleButton onClick={onClick} />

  return (
    <button
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-medium text-[#e1e7ef] transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82aaff]/60"
    >
      <span className="flex size-[18px] items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
        <ProviderIcon provider={provider} />
      </span>
      <span className="flex-1 text-left">
        Continue with <strong className="font-semibold">{provider.display_name}</strong>
      </span>
      <svg className="size-4 text-[#4a5a6a] transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

// ── Password form ──────────────────────────────────────────────────────────────

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
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label htmlFor="login-username" className="block text-xs font-medium text-[#637777] mb-1.5 tracking-wide uppercase">
          Email or username
        </label>
        <input
          id="login-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          disabled={loading}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-[#e1e7ef] placeholder:text-[#4a5a6a] outline-none transition-all duration-150 focus:border-[#82aaff]/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(130,170,255,0.08)] disabled:opacity-50"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-xs font-medium text-[#637777] mb-1.5 tracking-wide uppercase">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
          autoComplete="current-password"
          disabled={loading}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-[#e1e7ef] placeholder:text-[#4a5a6a] outline-none transition-all duration-150 focus:border-[#82aaff]/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(130,170,255,0.08)] disabled:opacity-50"
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-[#ef5350]/8 px-4 py-2.5 text-sm text-[#ef5350]">
          <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
          </svg>
          <span className="flex-1">{error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !username.trim() || !password}
        className="relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#82aaff] to-[#a78bfa] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#82aaff]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#82aaff]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing in...
          </>
        ) : (
          <span>Sign in with {providerDisplayName}</span>
        )}
      </button>
    </form>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LoginPage({
  authLoading,
  providers = [],
  providersLoading,
  authError,
  onLogin,
  onPasswordLogin,
  onRetry,
}: LoginPageProps) {
  const isLoading = authLoading || providersLoading

  const handleLogin = useCallback(
    (providerName: string) => onLogin?.(providerName),
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

  const passwordProvider = providers.find((p) => p.supports_password)
  const oauthProviders = providers.filter((p) => !p.supports_password)
  const hasAnyProviders = providers.length > 0

  // ── CTA section ──
  let ctaSection: React.ReactNode

  if (isLoading) {
    ctaSection = (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="h-11 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="h-11 w-3/4 animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
    )
  } else if (authError && !hasAnyProviders) {
    ctaSection = (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-[#ef5350]/8 px-4 py-3 text-sm text-[#ef5350]">
          <svg className="size-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
          </svg>
          <span>{authError}</span>
        </div>
        <button
          onClick={onRetry}
          className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2 text-sm font-medium text-[#e1e7ef] transition-all duration-200 hover:bg-white/[0.08] active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    )
  } else if (oauthProviders.length > 0) {
    ctaSection = (
      <div className="space-y-2.5">
        {oauthProviders.map((p) => (
          <OAuthButton
            key={p.name}
            provider={p}
            onClick={() => handleLogin(p.name)}
            onKeyDown={(e) => handleKeyDown(e, p.name)}
          />
        ))}
        {passwordProvider && onPasswordLogin && (
          <>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0d2942] px-3 text-xs text-[#4a5a6a]">or sign in with email</span>
              </div>
            </div>
            <PasswordForm
              providerName={passwordProvider.name}
              providerDisplayName={passwordProvider.display_name}
              onPasswordLogin={onPasswordLogin}
            />
          </>
        )}
      </div>
    )
  } else if (passwordProvider && onPasswordLogin) {
    ctaSection = (
      <PasswordForm
        providerName={passwordProvider.name}
        providerDisplayName={passwordProvider.display_name}
        onPasswordLogin={onPasswordLogin}
      />
    )
  } else if (!isLoading) {
    ctaSection = (
      <div className="py-6 text-center">
        <div className="flex items-center justify-center gap-2.5 rounded-xl bg-[#ef5350]/8 px-4 py-3 text-sm text-[#ef5350]">
          <svg className="size-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
          </svg>
          <span>No sign-in methods configured.</span>
        </div>
        <p className="text-xs text-[#4a5a6a] mt-3 m-0">Contact your administrator.</p>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[1500] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#011627' }}
    >
      {/* Animated gradient background */}
      <ShaderBackground className="pointer-events-none absolute inset-0" />

      {/* Decorative floating elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Large glow orb — top left */}
        <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-[#82aaff]/5 blur-[120px]" />
        {/* Secondary glow — bottom right */}
        <div className="absolute -bottom-40 -right-24 size-[400px] rounded-full bg-[#a78bfa]/5 blur-[120px]" />

        {/* Decorative ring — top area */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[600px] rounded-full border border-white/[0.02]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[500px] rounded-full border border-white/[0.015]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[400px] rounded-full border border-white/[0.01]" />

        {/* Floating diamond dots */}
        <div className="absolute top-[15%] right-[12%] size-1.5 rounded-full bg-[#82aaff]/20" />
        <div className="absolute bottom-[25%] left-[10%] size-1 rounded-full bg-[#a78bfa]/15" />
        <div className="absolute top-[35%] right-[8%] size-2 rounded-full bg-white/[0.04]" />
        <div className="absolute bottom-[30%] right-[20%] size-1.5 rounded-full bg-white/[0.03]" />
      </div>

      {/* Top accent gradient line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[#82aaff]/40 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-sm px-5">
        <div className="relative group">
          {/* Outer glow behind card */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-[#82aaff]/10 to-[#a78bfa]/10 blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

          {/* Card with gradient border via pseudo-layer */}
          <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-[1px] shadow-2xl shadow-black/50">
            <div className="rounded-2xl bg-[#0a1e33]/80 backdrop-blur-2xl p-8">
              {/* Inner subtle glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/[0.05] ring-inset" />

              {/* Brand icon with animated pulse ring */}
              <div className="flex flex-col items-center gap-4 mb-7">
                <div className="relative">
                  {/* Glow ring behind icon */}
                  <div className="absolute -inset-3 rounded-full bg-[#82aaff]/10 animate-pulse" />
                  <div className="absolute -inset-1.5 rounded-full bg-[#82aaff]/15" />
                  <div className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#82aaff]/20 to-[#a78bfa]/10 ring-1 ring-[#82aaff]/15">
                    <BrandMark className="size-7 text-[#82aaff]" />
                  </div>
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-[#e1e7ef] to-[#a5b4fc] bg-clip-text text-transparent m-0">
                    Welcome back
                  </h1>
                  <p className="text-sm text-[#637777] mt-1.5 m-0">Sign in to your account</p>
                </div>
              </div>

              {/* CTA */}
              <div className="min-h-[80px] relative z-[1]">
                {ctaSection}
              </div>

              {/* Footer */}
              <div className="mt-7 pt-5 border-t border-white/[0.04]">
                <p className="text-[11px] text-center text-[#4a5a6a] m-0 tracking-wider uppercase">
                  Open source &middot; Private &middot; Secure
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="mt-6 flex justify-center gap-1.5">
          <div className="size-1 rounded-full bg-[#82aaff]/20" />
          <div className="size-1 rounded-full bg-[#82aaff]/30" />
          <div className="size-1 rounded-full bg-[#82aaff]/20" />
        </div>
      </div>
    </div>
  )
}
