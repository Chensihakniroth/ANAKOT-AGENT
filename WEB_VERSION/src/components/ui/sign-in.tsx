/**
 * Sign-in page — split-layout design by 21dev.
 *
 * Left column: branded form with Google OIDC + email/password.
 * Right column: hero image with floating testimonials.
 */
import React, { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { AuthProvider } from '@/hooks/use-auth';

// ── Google SVG icon (inline, no deps) ───────────────────────────────────────

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export interface SignInPageProps {
  /** Loading state while auth session is being checked */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Providers fetched from backend */
  providers: AuthProvider[];
  /** Called when user clicks Google/OIDC sign-in button */
  onGoogleSignIn?: () => void;
  /** Called when email/password form is submitted (provider, username, password) */
  onPasswordLogin?: (provider: string, username: string, password: string) => Promise<boolean>;
  /** Called when the user wants to sign in via OIDC (any) */
  onLogin?: (providerName: string) => void;
  /** Hero image URL */
  heroImageSrc?: string;
  /** Testimonials for the hero section */
  testimonials?: Testimonial[];
}

// ── Sub-components ───────────────────────────────────────────────────────────

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[var(--dt-border)] bg-[var(--dt-muted)]/30 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div
    className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-[var(--dt-card)]/40 backdrop-blur-xl border border-white/10 p-5 w-64`}
  >
    <img
      src={testimonial.avatarSrc}
      className="h-10 w-10 object-cover rounded-2xl"
      alt="avatar"
    />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium text-[var(--dt-foreground)]">
        {testimonial.name}
      </p>
      <p className="text-[var(--dt-muted-foreground)]">{testimonial.handle}</p>
      <p className="mt-1 text-[var(--dt-foreground)]/80">{testimonial.text}</p>
    </div>
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

export const SignInPage: React.FC<SignInPageProps> = ({
  loading = false,
  error = null,
  providers,
  onGoogleSignIn,
  onPasswordLogin,
  onLogin,
  heroImageSrc = 'https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80',
  testimonials = [
    {
      avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg',
      name: 'Sarah Chen',
      handle: '@sarahdigital',
      text: 'Amazing platform! The user experience is seamless and the features are exactly what I needed.',
    },
    {
      avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg',
      name: 'Marcus Johnson',
      handle: '@marcustech',
      text: 'This service has transformed how I work. Clean design, powerful features, and excellent support.',
    },
    {
      avatarSrc: 'https://randomuser.me/api/portraits/men/32.jpg',
      name: 'David Martinez',
      handle: '@davidcreates',
      text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful.",
    },
  ],
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Find the OIDC/Google provider and the password provider
  const oidcProvider = providers.find(
    (p) =>
      p.name.toLowerCase().includes('google') ||
      p.name.toLowerCase().includes('oidc') ||
      (p.display_name && p.display_name.toLowerCase().includes('oidc')) ||
      (p.display_name && p.display_name.toLowerCase().includes('google')),
  );
  const passwordProvider = providers.find((p) => p.supports_password);

  const handleGoogleClick = useCallback(() => {
    if (onGoogleSignIn) {
      onGoogleSignIn();
    } else if (onLogin && oidcProvider) {
      onLogin(oidcProvider.name);
    }
  }, [onGoogleSignIn, onLogin, oidcProvider]);

  const handleSignIn = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onPasswordLogin || !passwordProvider) return;
      const formData = new FormData(event.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      if (!email || !password) {
        setFormError('Please enter both email and password.');
        return;
      }

      setSubmitting(true);
      setFormError(null);
      try {
        await onPasswordLogin(passwordProvider.name, email, password);
      } catch {
        setFormError('Sign in failed. Check your credentials and try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [onPasswordLogin, passwordProvider],
  );

  const displayError = error || formError;

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw] bg-[var(--dt-background)] text-[var(--dt-foreground)]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight tracking-tighter">
              Welcome
            </h1>
            <p className="animate-element animate-delay-200 text-[var(--dt-muted-foreground)]">
              Access your account and continue your journey with us
            </p>

            {displayError && (
              <div className="animate-element animate-delay-250 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {displayError}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSignIn}>
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-[var(--dt-muted-foreground)]">
                  Email Address
                </label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-[var(--dt-foreground)] placeholder:text-[var(--dt-muted-foreground)]/50"
                    autoComplete="email"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-[var(--dt-muted-foreground)]">
                  Password
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-[var(--dt-foreground)] placeholder:text-[var(--dt-muted-foreground)]/50"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-[var(--dt-muted-foreground)] hover:text-[var(--dt-foreground)] transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-[var(--dt-muted-foreground)] hover:text-[var(--dt-foreground)] transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="rounded border-[var(--dt-border)] bg-[var(--dt-muted)] accent-violet-500"
                  />
                  <span className="text-[var(--dt-foreground)]/90">Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-[var(--dt-primary)] py-4 font-medium text-[var(--dt-primary-foreground)] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {oidcProvider && (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-[var(--dt-border)]" />
                  <span className="px-4 text-sm text-[var(--dt-muted-foreground)] bg-[var(--dt-background)] absolute">
                    Or continue with
                  </span>
                </div>

                <button
                  onClick={handleGoogleClick}
                  disabled={loading}
                  className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-[var(--dt-border)] rounded-2xl py-4 hover:bg-[var(--dt-muted)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            <p className="animate-element animate-delay-900 text-center text-sm text-[var(--dt-muted-foreground)]">
              Open source &middot; Private &middot; Secure
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
