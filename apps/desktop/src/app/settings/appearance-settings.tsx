import { useStore } from '@nanostores/react'
import { useCallback, useRef, useState } from 'react'

import type { AnakotGateway } from '@/anakot'
import { LanguageSwitcher } from '@/components/language-switcher'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, ImageIcon, Palette, Plus, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $toolViewMode, setToolViewMode } from '@/store/tool-view'
import { useTheme } from '@/themes/context'
import { BUILTIN_THEMES } from '@/themes/presets'

import { MODE_OPTIONS } from './constants'
import {
  BUILT_IN_BACKGROUNDS,
  readFileAsDataUrl,
  saveUploadedImage,
  setBackgroundImage,
  setBackgroundOpacity,
  setBackgroundPositionX,
  setBackgroundPositionY,
  setBackgroundSize
} from './background-image-settings'
import { $backgroundImage, $backgroundOpacity, $backgroundPositionX, $backgroundPositionY, $backgroundSize, $backgroundType, setBackgroundType } from '@/store/background'
import { ShaderBackground } from '@/components/ui/shader-background'
import { ListRow, SectionHeading, SettingsContent } from './primitives'

function ThemePreview({ name }: { name: string }) {
  const t = BUILTIN_THEMES[name]

  if (!t) {
    return null
  }

  const c = t.colors

  return (
    <div
      className="h-20 overflow-hidden rounded-xl border shadow-xs"
      style={{ backgroundColor: c.background, borderColor: c.border }}
    >
      <div className="flex h-full">
        <div
          className="w-12 border-r"
          style={{
            backgroundColor: c.sidebarBackground ?? c.muted,
            borderColor: c.sidebarBorder ?? c.border
          }}
        />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="h-2.5 w-16 rounded-full" style={{ backgroundColor: c.foreground }} />
          <div className="h-2 w-24 rounded-full" style={{ backgroundColor: c.mutedForeground }} />
          <div className="mt-auto flex justify-end">
            <div
              className="h-5 w-16 rounded-full border"
              style={{
                backgroundColor: c.userBubble ?? c.muted,
                borderColor: c.userBubbleBorder ?? c.border
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function BackgroundImageSettings() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Resolve a built-in path to a full URL for <img> src attributes
  const resolveBuiltIn = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const url = await saveUploadedImage(file)
      setBackgroundImage(url)
      triggerHaptic('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image.')
      triggerHaptic('warning')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleClear = () => {
    setBackgroundImage(null)
    setError(null)
    triggerHaptic('selection')
  }

  const handleOpacityChange = (value: number) => {
    setBackgroundOpacity(value)
  }

  const handleSelectBuiltIn = (bg: typeof BUILT_IN_BACKGROUNDS[number]) => {
    // Store the raw relative path (e.g. "ds-assets/filler-bg0.jpg")
    // AppShell will resolve it against BASE_URL at render time
    setBackgroundImage(bg.path)
    triggerHaptic('crisp')
  }

  // Use nanostore for reactive state
  const image = useStore($backgroundImage)
  const opacity = useStore($backgroundOpacity)
  const posX = useStore($backgroundPositionX)
  const posY = useStore($backgroundPositionY)
  const size = useStore($backgroundSize)

  // For the gallery, check if current image matches a built-in path
  const currentBuiltInId = image
    ? BUILT_IN_BACKGROUNDS.find(b => b.path === image || image.endsWith(b.path))?.id ?? null
    : null

  // Resolve the current image src for the preview
  const previewSrc = image
    ? (/^https?:\/\/|^file:\/\/\/|^data:/.test(image) ? image : `${import.meta.env.BASE_URL}${image.replace(/^\/+/, '')}`)
    : null

  // Read current type
  const bgType = useStore($backgroundType)

  return (
    <ListRow
      below={
        <div className="mt-3 grid gap-4">
          {/* Type selector */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-(--ui-text-secondary)">Background type</span>
            <SegmentedControl
              value={bgType}
              onChange={(v: 'image' | 'shader') => { setBackgroundType(v); triggerHaptic('crisp') }}
              options={[
                { id: 'shader', label: 'Shader' },
                { id: 'image', label: 'Image' },
              ]}
            />
          </div>

          {/* Dynamic preview or image UI */}
          {bgType === 'shader' ? (
            <div className="relative h-40 overflow-hidden rounded-xl border border-(--ui-stroke-tertiary)">
              <ShaderBackground />
            </div>
          ) : (
            <>
              {image && (
                <div className="relative overflow-hidden rounded-xl border border-(--ui-stroke-tertiary)">
                  <img alt="Background preview" className="h-40 w-full object-cover" src={image} />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/30" onClick={() => inputRef.current?.click()} type="button">
                      <Plus className="size-3.5" /> Replace
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-red-500/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-red-500/80" onClick={handleClear} type="button">
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Built-in gallery */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-(--ui-text-secondary)">Built-in Backgrounds</span>
                  {!image && (
                    <span className="text-[0.65rem] text-muted-foreground">Click one to apply</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Upload card */}
                  <button
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-3 transition-colors',
                      dragOver
                        ? 'border-primary bg-primary/5'
                        : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) hover:border-(--ui-stroke-secondary) hover:bg-(--chrome-action-hover)'
                    )}
                    onClick={() => inputRef.current?.click()}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    type="button"
                  >
                    <Plus className="size-5 text-muted-foreground" />
                    <span className="text-[0.65rem] leading-tight text-muted-foreground">Upload</span>
                  </button>

                  {/* Built-in images */}
                  {BUILT_IN_BACKGROUNDS.map(bg => {
                    const url = resolveBuiltIn(bg.path)
                    const active = currentBuiltInId === bg.id

                    return (
                      <button
                        className={cn(
                          'group relative h-20 w-28 overflow-hidden rounded-lg border-2 transition-all',
                          active
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent hover:border-(--ui-stroke-secondary)'
                        )}
                        key={bg.id}
                        onClick={() => handleSelectBuiltIn(bg)}
                        title={bg.label}
                        type="button"
                      >
                        <img
                          alt={bg.label}
                          className="h-full w-full object-cover"
                          src={url}
                        />
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                            <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-0.5">
                          <span className="text-[0.6rem] font-medium text-white">{bg.label}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Opacity slider — works for both shader and image */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Opacity</span>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              className="w-full accent-primary"
              max={1}
              min={0}
              onChange={e => handleOpacityChange(parseFloat(e.target.value))}
              step={0.01}
              type="range"
              value={opacity}
            />
            <div className="flex justify-between text-[0.65rem] text-muted-foreground/50">
              <span>Subtle</span>
              <span>Full</span>
            </div>
          </div>

          {/* Position & Size — only for image type */}
          {image && bgType === 'image' && (
            <div className="grid gap-3">
              {/* Live preview */}
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Preview</span>
                <div className="relative h-32 w-full overflow-hidden rounded-lg border border-(--ui-stroke-tertiary)">
                  {previewSrc && (
                    <img
                      alt="Position preview"
                      className="h-full w-full"
                      src={previewSrc}
                      style={{
                        objectPosition: `${posX}% ${posY}%`,
                        objectFit: size as React.CSSProperties['objectFit'],
                        opacity: opacity
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Size selector */}
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Fit</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['cover', 'contain', 'auto'] as const).map(opt => (
                    <button
                      className={cn(
                        'rounded-md border px-3 py-1 text-xs transition-colors',
                        size === opt
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-muted-foreground hover:bg-(--chrome-action-hover)'
                      )}
                      key={opt}
                      onClick={() => setBackgroundSize(opt)}
                      type="button"
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Position X slider */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Position X</span>
                  <span className="text-xs font-mono text-muted-foreground">{posX}%</span>
                </div>
                <input
                  className="w-full accent-primary"
                  max={100}
                  min={0}
                  onChange={e => setBackgroundPositionX(parseInt(e.target.value, 10))}
                  step={1}
                  type="range"
                  value={posX}
                />
                <div className="flex justify-between text-[0.65rem] text-muted-foreground/50">
                  <span>Left</span>
                  <span>Center</span>
                  <span>Right</span>
                </div>
              </div>

              {/* Position Y slider */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Position Y</span>
                  <span className="text-xs font-mono text-muted-foreground">{posY}%</span>
                </div>
                <input
                  className="w-full accent-primary"
                  max={100}
                  min={0}
                  onChange={e => setBackgroundPositionY(parseInt(e.target.value, 10))}
                  step={1}
                  type="range"
                  value={posY}
                />
                <div className="flex justify-between text-[0.65rem] text-muted-foreground/50">
                  <span>Top</span>
                  <span>Center</span>
                  <span>Bottom</span>
                </div>
              </div>

              {/* Reset position button */}
              <div className="flex justify-end">
                <button
                  className="text-xs text-muted-foreground underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-(--ui-text-secondary) hover:decoration-(--ui-text-secondary)/50"
                  onClick={() => { setBackgroundPositionX(50); setBackgroundPositionY(50) }}
                  type="button"
                >
                  Reset to center
                </button>
              </div>
            </div>
          )}

          <input
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleInputChange}
            ref={inputRef}
            type="file"
          />
        </div>
      }
      title="Background Image"
      description="Choose a built-in background or upload your own for the chat area"
      wide
    />
  )
}

export function AppearanceSettings({ gateway }: { gateway?: AnakotGateway | null }) {
  const { t, isSavingLocale } = useI18n()
  const { themeName, mode, availableThemes, setTheme, setMode } = useTheme()
  const toolViewMode = useStore($toolViewMode)
  const a = t.settings.appearance

  // Persist theme to config.yaml so it survives app restarts (localStorage may be cleared in dev)
  const applyTheme = useCallback((name: string) => {
    setTheme(name)
    if (gateway) {
      gateway.request('config.set', { key: 'display.theme', value: name }).catch(() => {})
    }
  }, [gateway, setTheme])

  const modeOptions = MODE_OPTIONS.map(({ id, icon }) => ({ icon, id, label: t.settings.modeOptions[id].label }))

  const toolOptions = [
    { id: 'product', label: a.product },
    { id: 'technical', label: a.technical }
  ] as const

  return (
    <SettingsContent>
      <div>
        <SectionHeading icon={Palette} title={a.title} />
        <p className="max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
          {a.intro}
        </p>

        <div className="mt-2 divide-y divide-(--ui-stroke-tertiary)">
          <ListRow
            action={<LanguageSwitcher />}
            description={isSavingLocale ? t.language.saving : t.language.description}
            title={t.language.label}
          />

          <ListRow
            action={
              <SegmentedControl
                onChange={id => {
                  triggerHaptic('crisp')
                  setMode(id)
                }}
                options={modeOptions}
                value={mode}
              />
            }
            description={a.colorModeDesc}
            title={a.colorMode}
          />

          <ListRow
            below={
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {availableThemes.map(theme => {
                  const active = themeName === theme.name

                  return (
                    <button
                      className={cn(
                        'rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-2 text-left transition hover:bg-(--chrome-action-hover)',
                        active && 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary)'
                      )}
                      key={theme.name}
                      onClick={() => {
                        triggerHaptic('crisp')
                        applyTheme(theme.name)
                      }}
                      type="button"
                    >
                      <ThemePreview name={theme.name} />
                      <div className="mt-3 flex items-start justify-between gap-3 px-1">
                        <div className="min-w-0">
                          <div className="truncate text-[length:var(--conversation-text-font-size)] font-medium">
                            {theme.label}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
                            {theme.description}
                          </div>
                        </div>
                        {active && (
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3.5" />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            }
            description={a.themeDesc}
            title={a.themeTitle}
            wide
          />

          <BackgroundImageSettings />

          <ListRow
            action={
              <SegmentedControl
                onChange={id => {
                  triggerHaptic('selection')
                  setToolViewMode(id)
                }}
                options={toolOptions}
                value={toolViewMode}
              />
            }
            description={a.toolViewDesc}
            title={a.toolViewTitle}
          />
        </div>
      </div>
    </SettingsContent>
  )
}
