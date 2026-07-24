import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface SplashScreenProps {
  /** True while the app is still loading its initial connection. */
  loading: boolean
}

/**
 * Full-screen branded splash shown on mobile while the app initialises.
 * Fades out smoothly once `loading` becomes false.
 *
 * On desktop this renders nothing.
 */
export function SplashScreen({ loading }: SplashScreenProps) {
  const isMobile = useIsMobile()

  if (!isMobile) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-(--dt-app-background) transition-opacity duration-500',
        loading ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      {/* App icon */}
      <div className="relative mb-6 size-16">
        <svg viewBox="0 0 48 48" fill="none" className="size-full" aria-hidden="true">
          {/* Stylised chat bubble with bolt */}
          <rect width="48" height="48" rx="12" fill="var(--dt-primary)" />
          <path
            d="M24 12c-6.627 0-12 4.477-12 10 0 3.126 1.627 5.92 4.167 7.77L14 32l4.8-2.4A13.5 13.5 0 0 0 24 30c6.627 0 12-4.477 12-10s-5.373-10-12-10Z"
            fill="var(--dt-primary-foreground)"
            opacity="0.9"
          />
          <path
            d="M22 14l-2 8h3.5L22 28l7-8.5h-3.5L27 14Z"
            fill="var(--dt-primary)"
            stroke="var(--dt-primary-foreground)"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
        Anakot
      </h1>

      {/* Subtitle */}
      <p className="mb-8 text-xs text-muted-foreground">
        {loading ? 'Connecting…' : 'Ready'}
      </p>

      {/* Pulse dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'size-1.5 rounded-full',
              loading
                ? 'bg-(--dt-primary) animate-bounce'
                : 'bg-green-500'
            )}
            style={
              loading
                ? {
                    animationDelay: `${i * 150}ms`,
                    animationDuration: '900ms'
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
