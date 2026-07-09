import { useMemo } from 'react'
import { usePlugins } from './usePlugins'

const HIDDEN_PLUGINS = new Set(['kanban', 'anakot-achievements'])

export function PluginsView({ onClose: onOverlayClose }: { onClose?: () => void }) {
  const { manifests, loading } = usePlugins()

  const visibleManifests = useMemo(
    () => manifests.filter((m) => !HIDDEN_PLUGINS.has(m.name)),
    [manifests],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {loading && visibleManifests.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Loading plugins…</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 opacity-40">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 96 96" stroke="currentColor" strokeWidth={1}>
                <rect x="8" y="20" width="80" height="56" rx="8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M32 44h32M32 56h20" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M38 28l10-12 10 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-secondary)]">
              Coming Soon
            </h2>
            <p className="mt-2 max-w-xs text-sm text-[var(--color-text-tertiary)]">
              The plugins ecosystem is being redesigned for the web. Stay tuned!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
