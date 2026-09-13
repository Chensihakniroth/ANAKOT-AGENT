/**
 * Message bubble transparency — how much of your own bubble's fill shows.
 *
 * One 0–100 lever, same direction as Window Translucency: 0 keeps the bubble
 * solid (default), 100 leaves only the outline. Presentation-only.
 */

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const KEY = 'anakot.desktop.user-bubble-transparency.v1'
const TRANSLUCENCY_MIN = 0
const TRANSLUCENCY_MAX = 100

function clampIntensity(value: string | null): number {
  const parsed = parseInt(value ?? '', 10)
  if (Number.isNaN(parsed)) {
    return TRANSLUCENCY_MIN
  }
  return Math.max(TRANSLUCENCY_MIN, Math.min(TRANSLUCENCY_MAX, parsed))
}

export const $userBubbleTransparency = atom<number>(
  typeof window === 'undefined' ? TRANSLUCENCY_MIN : clampIntensity(storedString(KEY))
)

export function setUserBubbleTransparency(value: number): void {
  $userBubbleTransparency.set(Math.max(TRANSLUCENCY_MIN, Math.min(TRANSLUCENCY_MAX, value)))
}

if (typeof window !== 'undefined') {
  $userBubbleTransparency.subscribe(value => {
    const root = document.documentElement

    if (value === TRANSLUCENCY_MIN) {
      root.style.removeProperty('--user-bubble-keep')
      persistString(KEY, null)
    } else {
      root.style.setProperty('--user-bubble-keep', `${TRANSLUCENCY_MAX - value}%`)
      persistString(KEY, String(value))
    }
  })
}
