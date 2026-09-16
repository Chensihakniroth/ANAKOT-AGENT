import { useStore } from '@nanostores/react'

import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { $displayTimestamps, setDisplayTimestamps } from '@/store/display-timestamps'
import {
  $timestampFormat,
  setTimestampFormat,
  formatTimestamp,
  type TimestampFormat
} from '@/store/timestamp-format'
import { $userBubbleTransparency, setUserBubbleTransparency } from '@/store/user-bubble-transparency'
import { SectionHeading, ListRow, SettingsContent } from './primitives'
import { Clock, Eye, MessageCircle } from '@/lib/icons'
import { cn } from '@/lib/utils'

const TIMESTAMP_FORMATS: { value: TimestampFormat; label: string }[] = [
  { value: 'time', label: 'Time only' },
  { value: 'seconds', label: 'With seconds' },
  { value: 'date', label: 'Date + time' },
  { value: 'relative', label: 'Relative' },
]

function formatPreview(format: TimestampFormat): string {
  const now = Date.now()
  switch (format) {
    case 'time':
      return formatTimestamp(now, 'time')
    case 'seconds':
      return formatTimestamp(now, 'seconds')
    case 'date':
      return formatTimestamp(now, 'date')
    case 'relative':
      return 'just now'
    default:
      return formatTimestamp(now, 'time')
  }
}

function formatRelativeDemo(): string {
  const now = Date.now()
  return `${formatTimestamp(now - 5 * 60 * 1000, 'relative')} · ${formatTimestamp(now - 3 * 60 * 60 * 1000, 'relative')} · ${formatTimestamp(now - 2 * 24 * 60 * 60 * 1000, 'relative')}`
}

export function DisplaySettings() {
  const { t } = useI18n()
  const showTimestamps = useStore($displayTimestamps)
  const timestampFormat = useStore($timestampFormat)
  const bubbleTransparency = useStore($userBubbleTransparency)

  return (
    <SettingsContent>
      <div className="space-y-6">
        {/* ── Timestamps ─────────────────────────────────── */}
        <div>
          <SectionHeading icon={Clock} title="Timestamps" />
          <div className="space-y-1 divide-y divide-border/30">
            <ListRow
              action={<Switch checked={showTimestamps} onCheckedChange={setDisplayTimestamps} />}
              description="Show timestamps next to tool calls and messages in the chat."
              title="Show timestamps"
            />

            {showTimestamps && (
              <>
                <div className="py-3">
                  <div className="mb-2 text-sm font-medium text-foreground">
                    Format
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TIMESTAMP_FORMATS.map(fmt => (
                      <button
                        key={fmt.value}
                        onClick={() => setTimestampFormat(fmt.value)}
                        className={cn(
                          'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                          timestampFormat === fmt.value
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border/40 text-(--ui-text-secondary) hover:border-border hover:text-foreground'
                        )}
                      >
                        <span className="text-sm font-medium">{fmt.label}</span>
                        <span className="text-[0.68rem] font-mono text-(--ui-text-tertiary)">
                          {fmt.value === 'relative' ? formatRelativeDemo() : formatPreview(fmt.value)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Message Bubbles ────────────────────────────── */}
        <div>
          <SectionHeading icon={MessageCircle} title="Message Bubbles" />
          <div className="space-y-1 divide-y divide-border/30">
            <ListRow
              action={
                <span className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bubbleTransparency}
                    onChange={e => setUserBubbleTransparency(Number(e.target.value))}
                    className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-(--ui-bg-elevated) accent-primary"
                  />
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-(--ui-text-secondary)">
                    {bubbleTransparency}%
                  </span>
                </span>
              }
              description="Adjust how transparent your message bubbles appear. 0% = solid, 100% = nearly invisible."
              title="Bubble transparency"
            />
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────── */}
        <div>
          <SectionHeading icon={Eye} title="Preview" />
          <div className="rounded-xl border border-border/40 bg-(--ui-bg-elevated) p-4">
            <div className="flex flex-col gap-3">
              {/* Simulated user bubble */}
              <div className="flex justify-end">
                <div
                  style={{ opacity: bubbleTransparency > 0 ? (100 - bubbleTransparency) / 100 : 1 }}
                  className="max-w-[70%] rounded-xl bg-(--dt-user-bubble) px-3 py-2 text-sm text-foreground"
                >
                  Hello, how are you?
                  {showTimestamps && (
                    <div className="mt-1 text-right text-[0.62rem] tabular-nums text-(--ui-text-tertiary)">
                      {formatTimestamp(Date.now() - 30000, timestampFormat)}
                    </div>
                  )}
                </div>
              </div>
              {/* Simulated assistant response */}
              <div className="flex justify-start">
                <div className="max-w-[70%] text-sm text-(--ui-text-secondary)">
                  I'm doing great! How can I help you today?
                  {showTimestamps && (
                    <div className="mt-1 text-[0.62rem] tabular-nums text-(--ui-text-tertiary)">
                      {formatTimestamp(Date.now(), timestampFormat)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsContent>
  )
}
