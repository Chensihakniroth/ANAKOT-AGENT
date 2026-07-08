'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { Search, Download, ExternalLink, Star, Check } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useTheme } from '@/themes/context'
import { fetchVscodeThemes, installVscodeTheme, vscodeThemeToDesktopTheme, type VscodeThemeEntry } from '@/themes/vscode-marketplace'
import { registerCustomTheme, $customThemes } from '@/themes/custom-themes-store'

interface VscodeThemeBrowserProps {
  onClose?: () => void
}

export function VscodeThemeBrowser({ onClose }: VscodeThemeBrowserProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [themes, setThemes] = useState<VscodeThemeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState<VscodeThemeEntry | null>(null)

  const loadThemes = useCallback(async (search?: string) => {
    setLoading(true)
    setError(null)
    try {
      const results = await fetchVscodeThemes(search)
      setThemes(results)
      if (results.length === 0) {
        setError('No themes found. Try a different search term.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThemes()
  }, [loadThemes])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    void loadThemes(query || undefined)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <form className="flex items-center gap-2 px-4 pb-3" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={e => setQuery(e.target.value)}
            placeholder="Search VS Code themes..."
            value={query}
          />
        </div>
        <Button disabled={loading} size="sm" type="submit">
          Search
        </Button>
      </form>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="size-6" type="spiral-search" />
          </div>
        )}

        {error && (
          <p className="py-8 text-center text-xs text-muted-foreground">{error}</p>
        )}

        {!loading && themes.length > 0 && (
          <div className="grid gap-2">
            {themes.map(theme => (
              <ThemeCard
                key={theme.extensionId}
                isSelected={selectedTheme?.extensionId === theme.extensionId}
                onSelect={() => setSelectedTheme(theme)}
                theme={theme}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  isSelected,
  onSelect
}: {
  theme: VscodeThemeEntry
  isSelected: boolean
  onSelect: () => void
}) {
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const { setTheme } = useTheme()
  const customThemes = useStore($customThemes)

  // Compute the custom theme key the same way vscodeThemeToDesktopTheme does
  const customThemeKey = `vsc:${theme.extensionId.replace(/\./g, '-')}`
  const installed = customThemeKey in customThemes

  const handleInstall = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (installing || installed) return
      setInstalling(true)
      setInstallError(null)
      try {
        const result = await installVscodeTheme(theme)
        if (result) {
          // Convert to DesktopTheme and register so it appears in the list
          const desktopTheme = vscodeThemeToDesktopTheme(theme, result.themeJson)
          registerCustomTheme(desktopTheme)
          // Set the newly installed theme as active
          setTheme(desktopTheme.name)
        } else {
          setInstallError('No theme JSON found in VSIX')
        }
      } catch {
        setInstallError('Install failed')
      } finally {
        setInstalling(false)
      }
    },
    [theme, installing, installed]
  )

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all',
        isSelected
          ? 'border-primary bg-accent/30'
          : 'border-border bg-background/50 hover:bg-accent/10'
      )}
    >
      {/* Icon */}
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {theme.iconUrl ? (
          <img
            alt={`${theme.name} icon`}
            className="size-full object-cover"
            loading="lazy"
            src={theme.iconUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
            {theme.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{theme.name}</span>
          <span className="shrink-0 text-[0.6rem] text-muted-foreground">
            v{theme.version}
          </span>
        </div>
        <p className="truncate text-[0.65rem] text-muted-foreground">{theme.publisher}</p>
        {theme.description && (
          <p className="mt-0.5 line-clamp-2 text-[0.65rem] text-muted-foreground/80">
            {theme.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
            <Download className="size-3" />
            {(theme.installs / 1000).toFixed(0)}k
          </span>
          {theme.rating > 0 && (
            <span className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
              <Star className="size-3 text-yellow-500" />
              {theme.rating.toFixed(1)} ({theme.ratingCount})
            </span>
          )}
          <span className={cn(
            'rounded-full px-1.5 py-px text-[0.55rem] font-medium uppercase',
            theme.isDark
              ? 'bg-indigo-500/10 text-indigo-500'
              : 'bg-amber-500/10 text-amber-600'
          )}>
            {theme.isDark ? 'Dark' : 'Light'}
          </span>
        </div>
        {installError && (
          <p className="mt-1 text-[0.6rem] text-destructive">{installError}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 flex-col gap-1">
        <button
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-[0.6rem] font-medium transition-colors',
            installed
              ? 'border-green-500/30 bg-green-500/10 text-green-600'
              : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-muted-foreground hover:bg-(--chrome-action-hover)'
          )}
          disabled={installing}
          onClick={handleInstall}
          type="button"
        >
          {installing ? (
            <Loader className="size-3" type="spiral-search" />
          ) : installed ? (
            <Check className="size-3" />
          ) : (
            <Download className="size-3" />
          )}
          {installing ? '...' : installed ? 'Installed' : 'Install'}
        </button>
        {theme.previewUrl && (
          <div className="hidden sm:block">
            <img
              alt={`${theme.name} preview`}
              className="h-12 w-20 rounded-md object-cover opacity-80"
              loading="lazy"
              src={theme.previewUrl}
            />
          </div>
        )}
      </div>
    </div>
  )
}
