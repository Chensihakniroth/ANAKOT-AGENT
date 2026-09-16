/**
 * Timestamp format preference for chat message timestamps.
 *
 * Controls how timestamps appear next to tool calls and messages:
 *   - time:     "2:34 PM"
 *   - seconds:  "2:34:56 PM"
 *   - date:     "Jan 15, 2026, 2:34 PM"
 *   - relative: "2m ago", "3h ago", "yesterday"
 */
import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

export type TimestampFormat = 'time' | 'seconds' | 'date' | 'relative'

const KEY = 'anakot.desktop.timestampFormat'

const VALID_FORMATS: TimestampFormat[] = ['time', 'seconds', 'date', 'relative']

function clampFormat(value: string | null): TimestampFormat {
  if (value && VALID_FORMATS.includes(value as TimestampFormat)) {
    return value as TimestampFormat
  }
  return 'time'
}

export const $timestampFormat = atom<TimestampFormat>(
  typeof window === 'undefined' ? 'time' : clampFormat(storedString(KEY))
)

export function setTimestampFormat(format: TimestampFormat): void {
  $timestampFormat.set(format)
}

/**
 * Format a timestamp (ms) according to the active preference.
 */
export function formatTimestamp(ms: number, format: TimestampFormat): string {
  const date = new Date(ms)

  switch (format) {
    case 'time':
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    case 'seconds':
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    case 'date':
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    case 'relative': {
      const diff = Date.now() - ms
      const secs = Math.floor(diff / 1000)
      if (secs < 60) return 'just now'
      const mins = Math.floor(secs / 60)
      if (mins < 60) return `${mins}m ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      if (days === 1) return 'yesterday'
      if (days < 7) return `${days}d ago`
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    default:
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
}

if (typeof window !== 'undefined') {
  $timestampFormat.subscribe(value => {
    persistString(KEY, value === 'time' ? null : value)
  })
}
