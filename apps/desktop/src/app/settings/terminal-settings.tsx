import { useState } from 'react'
import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Terminal, RefreshCw } from '@/lib/icons'
import { triggerHaptic } from '@/lib/haptics'

import { ListRow, SectionHeading, SettingsContent } from './primitives'
import {
  $terminalSettings,
  TERMINAL_FONT_OPTIONS,
  setTerminalSetting,
  resetTerminalSettings,
  type TerminalCursorStyle
} from '@/store/terminal-settings'
import { $keepAwake, setKeepAwake } from '@/store/keep-awake'
import { $completionSoundEnabled, setCompletionSoundEnabled } from '@/store/completion-sound'

const CURSOR_OPTIONS: { id: TerminalCursorStyle; label: string }[] = [
  { id: 'block', label: 'Block' },
  { id: 'underline', label: 'Underline' },
  { id: 'bar', label: 'Bar' }
]

function NumberSlider({
  value,
  min,
  max,
  step,
  onChange,
  unit
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-(--ui-bg-tertiary) accent-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
        max={max}
        min={min}
        onChange={e => onChange(Number(e.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <span className="min-w-10 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {value}{unit ?? ''}
      </span>
    </div>
  )
}

function TerminalPreview() {
  const settings = useStore($terminalSettings)

  return (
    <div
      className="rounded-lg border border-(--ui-stroke-tertiary) bg-[#1a1a2e] p-3 font-mono"
      style={{
        fontFamily: settings.fontFamily,
        fontSize: `${settings.fontSize}px`,
        lineHeight: 1.12,
        letterSpacing: `${settings.letterSpacing}px`
      }}
    >
      <div className="text-[#6272a4]">{'# Terminal Preview'}</div>
      <div>
        <span className="text-[#50fa7b]">user</span>
        <span className="text-[#f8f8f2]">@</span>
        <span className="text-[#bd93f9]">desktop</span>
        <span className="text-[#f8f8f2]"> ~ $ </span>
        <span className="text-[#f1fa8c]">echo</span>
        <span className="text-[#f8f8f2]"> &quot;Hello, World!&quot;</span>
      </div>
      <div className="text-[#f8f8f2]">Hello, World!</div>
      <div>
        <span className="text-[#50fa7b]">user</span>
        <span className="text-[#f8f8f2]">@</span>
        <span className="text-[#bd93f9]">desktop</span>
        <span className="text-[#f8f8f2]"> ~ $ </span>
        <span
          className="inline-block bg-[#f8f8f2]"
          style={{
            width: settings.cursorStyle === 'bar' ? '2px' : `${settings.fontSize * 0.6}px`,
            height: settings.cursorStyle === 'underline' ? '2px' : `${settings.fontSize}px`,
            animation: settings.cursorBlink ? 'pulse 1s infinite' : 'none',
            verticalAlign: settings.cursorStyle === 'underline' ? 'bottom' : 'text-bottom',
            opacity: 0.8
          }}
        />
      </div>
    </div>
  )
}

export function TerminalSettings() {
  const settings = useStore($terminalSettings)
  const keepAwake = useStore($keepAwake)
  const completionSoundEnabled = useStore($completionSoundEnabled)
  const [customFont, setCustomFont] = useState('')

  // Check if the current fontFamily matches one of the presets
  const isPresetFont = TERMINAL_FONT_OPTIONS.some(f => f.value === settings.fontFamily)
  const [showCustom, setShowCustom] = useState(!isPresetFont)

  return (
    <SettingsContent>
      <div className="space-y-1 divide-y divide-border/30">
        <SectionHeading icon={Terminal} title="Terminal" />

        <ListRow
          action={<Switch checked={keepAwake} onCheckedChange={setKeepAwake} />}
          description="Prevent the computer from sleeping while you leave Anakot running unattended."
          title="Keep Computer Awake"
        />

        <ListRow
          action={<Switch checked={completionSoundEnabled} onCheckedChange={setCompletionSoundEnabled} />}
          description="Play a short sound when the active agent turn finishes."
          title="Completion Sound"
        />

        {/* Live Preview */}
        <ListRow
          description="Preview of your terminal appearance settings."
          title="Preview"
          wide
          below={<TerminalPreview />}
        />

        {/* Font Family */}
        <ListRow
          description="The monospace font used in the integrated terminal."
          title="Font Family"
          action={
            showCustom ? (
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  onChange={e => {
                    setCustomFont(e.target.value)
                    if (e.target.value.trim()) {
                      setTerminalSetting('fontFamily', e.target.value)
                    }
                  }}
                  placeholder="'My Font', monospace"
                  value={customFont || (!isPresetFont ? settings.fontFamily : '')}
                />
                <Button
                  onClick={() => {
                    setShowCustom(false)
                    setTerminalSetting('fontFamily', TERMINAL_FONT_OPTIONS[0].value)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Preset
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={v => {
                    triggerHaptic('selection')
                    setTerminalSetting('fontFamily', v)
                  }}
                  value={settings.fontFamily}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINAL_FONT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.value }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    setShowCustom(true)
                    triggerHaptic('crisp')
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Custom
                </Button>
              </div>
            )
          }
        />

        {/* Font Size */}
        <ListRow
          description="Font size in pixels (8–24)."
          title="Font Size"
          action={
            <NumberSlider
              max={24}
              min={8}
              onChange={v => {
                triggerHaptic('selection')
                setTerminalSetting('fontSize', v)
              }}
              step={1}
              unit="px"
              value={settings.fontSize}
            />
          }
        />

        {/* Letter Spacing */}
        <ListRow
          description="Extra letter spacing in pixels (-2 to 5)."
          title="Letter Spacing"
          action={
            <NumberSlider
              max={5}
              min={-2}
              onChange={v => {
                triggerHaptic('selection')
                setTerminalSetting('letterSpacing', v)
              }}
              step={0.5}
              unit="px"
              value={settings.letterSpacing}
            />
          }
        />

        {/* Cursor Style */}
        <ListRow
          description="Shape of the terminal cursor."
          title="Cursor Style"
          action={
            <SegmentedControl
              onChange={id => {
                triggerHaptic('selection')
                setTerminalSetting('cursorStyle', id)
              }}
              options={CURSOR_OPTIONS}
              value={settings.cursorStyle}
            />
          }
        />

        {/* Cursor Blink */}
        <ListRow
          description="Whether the cursor blinks."
          title="Cursor Blink"
          action={
            <Switch
              checked={settings.cursorBlink}
              onCheckedChange={v => {
                triggerHaptic('selection')
                setTerminalSetting('cursorBlink', v)
              }}
              size="xs"
            />
          }
        />

        {/* Scrollback */}
        <ListRow
          description="Maximum number of lines kept in the scrollback buffer (100–10,000)."
          title="Scrollback Lines"
          action={
            <NumberSlider
              max={10000}
              min={100}
              onChange={v => {
                triggerHaptic('selection')
                setTerminalSetting('scrollback', v)
              }}
              step={100}
              value={settings.scrollback}
            />
          }
        />

        {/* Reset */}
        <div className="pt-4">
          <Button
            className="gap-2"
            onClick={() => {
              triggerHaptic('warning')
              resetTerminalSettings()
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="size-3.5" />
            Reset to Defaults
          </Button>
        </div>
      </div>
    </SettingsContent>
  )
}
