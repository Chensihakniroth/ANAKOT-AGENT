import { useStore } from '@nanostores/react'
import { useRef, useState } from 'react'

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
  getBackgroundImage,
  getBackgroundOpacity,
  readFileAsDataUrl,
  setBackgroundImage,
  setBackgroundOpacity
} from './background-image-settings'
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
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [image, setImage] = useState<string | null>(getBackgroundImage)
  const [opacity, setOpacity] = useState(getBackgroundOpacity)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setBackgroundImage(dataUrl)
      setImage(dataUrl)
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
    setImage(null)
    setError(null)
    triggerHaptic('selection')
  }

  const handleOpacityChange = (value: number) => {
    setOpacity(value)
    setBackgroundOpacity(value)
  }

  return (
    <ListRow
      below={
        <div className="mt-3 grid gap-3">
          {/* Drop zone / preview */}
          {image ? (
            <div className="relative overflow-hidden rounded-xl border border-(--ui-stroke-tertiary)">
              <img
                alt="Background preview"
                className="h-40 w-full object-cover"
                src={image}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  Replace
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-red-500/80"
                  onClick={handleClear}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              className={cn(
                'flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
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
              <Plus className={cn('size-6', dragOver ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-xs text-muted-foreground">
                {dragOver ? 'Drop image here' : 'Click to upload or drag & drop'}
              </span>
              <span className="text-[0.65rem] text-muted-foreground/60">PNG, JPG, WEBP — max 10 MB</span>
            </button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Opacity slider */}
          {image && (
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
      description="Upload a custom background image for the chat area"
      wide
    />
  )
}

export function AppearanceSettings() {
  const { t, isSavingLocale } = useI18n()
  const { themeName, mode, availableThemes, setTheme, setMode } = useTheme()
  const toolViewMode = useStore($toolViewMode)
  const a = t.settings.appearance

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
                        setTheme(theme.name)
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
