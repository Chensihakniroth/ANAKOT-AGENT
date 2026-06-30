import { useNavigate } from 'react-router-dom'
import { usePlugins } from './usePlugins'

export function PluginsView() {
  const { plugins, manifests, loading } = usePlugins()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none p-4 pb-0">
        <h1 className="text-xl font-bold tracking-tight">Plugins</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Manage your Anakot extensions and capabilities.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Loading plugins…</span>
          </div>
        ) : manifests.length === 0 ? (
          <div className="text-sm text-[var(--color-text-tertiary)]">No plugins found.</div>
        ) : (
          <ul className="space-y-3">
            {manifests.map((m) => {
              const isRegistered = plugins.some(p => p.manifest.name === m.name)
              return (
                <li key={m.name}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg border border-[var(--color-border)] p-4 shadow-sm bg-[var(--color-bg-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-tertiary)] cursor-pointer"
                    onClick={() => navigate(m.tab.path)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {m.label || m.name}
                        </div>
                        <div className="text-sm text-[var(--color-text-tertiary)]">
                          {m.description || 'No description'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isRegistered
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {isRegistered ? 'Active' : 'Loading…'}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          v{m.version}
                        </span>
                        <svg className="h-4 w-4 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
