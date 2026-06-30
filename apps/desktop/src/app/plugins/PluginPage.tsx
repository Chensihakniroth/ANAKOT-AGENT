/**
 * PluginPage — renders a single plugin's registered component.
 *
 * Once the plugin JS bundle loads and calls `register(name, Component)`,
 * this component renders that `Component`. Until then it shows a spinner
 * or an error message.
 */

import { useSyncExternalStore } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import {
  getPluginComponent,
  getPluginLoadError,
  onPluginRegistered,
} from './registry'

/** Renders a plugin tab once its bundle has called `register()`. */
export function PluginPage({ name }: { name: string }) {
  const Component = useSyncExternalStore(
    (onChange) => onPluginRegistered(onChange),
    () => getPluginComponent(name) ?? null,
    () => null,
  )
  const loadError = useSyncExternalStore(
    (onChange) => onPluginRegistered(onChange),
    () => getPluginLoadError(name) ?? null,
    () => null,
  )

  if (Component) {
    return (
      <ErrorBoundary
        label={`plugin-${name}`}
        fallback={({ error, reset }) => (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 text-red-500">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Plugin Crashed</h2>
            <p className="mb-6 max-w-md text-sm text-[var(--color-text-secondary)]">
              The plugin "{name}" encountered an unexpected error. 
            </p>
            <div className="mb-6 rounded-md bg-[var(--color-bg-secondary)] p-4 text-left text-xs font-mono text-red-400 overflow-auto max-w-full">
              {error.message}
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-[var(--color-bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverted)] hover:bg-opacity-90"
            >
              Try Again
            </button>
          </div>
        )}
      >
        <Component />
      </ErrorBoundary>
    )
  }

  if (loadError) {
    const message =
      loadError === 'LOAD_FAILED'
        ? `Plugin "${name}" failed to load.`
        : loadError === 'NO_REGISTER'
          ? `Plugin "${name}" loaded but did not call register().`
          : loadError
    return (
      <div
        className="max-w-lg p-4 text-sm text-red-500"
        role="alert"
      >
        {message}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-4 text-sm text-[var(--color-text-tertiary)]">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span>Loading plugin…</span>
    </div>
  )
}
