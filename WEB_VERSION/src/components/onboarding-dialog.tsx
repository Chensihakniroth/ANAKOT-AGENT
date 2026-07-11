import { useCallback, useState } from 'react'
import { api } from '@/lib/web-anakot-desktop'

interface OnboardingDialogProps {
  userEmail?: string
  onComplete: (profileName: string) => void
  onSkip?: () => void
}

/**
 * First-login onboarding dialog shown when an authenticated user has no
 * profile yet. Asks for a display name, creates the profile on the backend,
 * and calls back with the resulting profile name.
 */
export function OnboardingDialog({
  userEmail,
  onComplete,
  onSkip,
}: OnboardingDialogProps) {
  const [displayName, setDisplayName] = useState(
    userEmail?.split('@')[0] ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const name = displayName.trim()
      if (!name) {
        setError('Please enter a name')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const result = await api<{
          ok: boolean
          profile: string
          needs_onboarding: boolean
        }>({
          path: '/api/auth/onboard',
          method: 'POST',
          body: { display_name: name },
        })
        if (result.ok) {
          onComplete(result.profile)
        } else {
          setError('Failed to create profile')
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [displayName, onComplete],
  )

  return (
    <div className="fixed inset-0 z-[1500] flex flex-col items-center justify-center bg-[#011627] text-[#d6deeb] overflow-y-auto p-4">
      {/* Dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #d6deeb 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(130,170,255,0.08), transparent)',
        }}
        aria-hidden="true"
      />

      <main className="relative w-full max-w-sm animate-[fadeSlideUp_0.5s_ease-out_both]">
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            animation: none !important;
          }
        `}</style>

        <div className="rounded-lg border border-white/[0.07] bg-[#0b2942] p-6 sm:p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
          <h2 className="m-0 mb-1 text-lg font-semibold text-[#d6deeb]">
            Welcome to Anakot!
          </h2>
          <p className="mt-0 mb-5 text-sm text-[#637777]">
            Choose a display name to get started. This will be your profile
            name and cannot be changed later.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="onboard-name"
                className="block text-sm font-medium text-[#637777] mb-1.5"
              >
                Your name
              </label>
              <input
                id="onboard-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alice"
                autoFocus
                disabled={loading}
                className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-[#d6deeb] placeholder:text-[#637777] outline-none transition-colors focus:border-[#82aaff]/50 focus:ring-1 focus:ring-[#82aaff]/30 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-sm text-[#ef5350] m-0">{error}</p>
            )}

            <div className="flex gap-3">
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={loading}
                  className="flex-1 cursor-pointer rounded-md border border-white/[0.1] bg-transparent px-4 py-2.5 text-sm font-medium text-[#637777] transition-colors hover:bg-white/[0.04] hover:text-[#d6deeb] disabled:opacity-50"
                >
                  Skip for now
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="flex-1 cursor-pointer rounded-md bg-[#82aaff] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6b96e0] disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Get started'}
              </button>
            </div>
          </form>

          <p className="mt-4 text-xs text-[#637777]">
            Profile name: letters, numbers, hyphens, and underscores only.
          </p>
        </div>
      </main>
    </div>
  )
}
