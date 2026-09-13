/**
 * `display.timestamps` — one config key for message timestamps everywhere.
 *
 * The same config.yaml key that puts [HH:MM] stamps on classic-CLI labels
 * gates the desktop transcript's per-message / per-tool-run timeline
 * timestamps (#41531, #65272, #68052). Off by default, matching the CLI
 * default in hermes_cli/config_defaults.py.
 *
 * Display-only: reading or toggling it never mutates model context, so it is
 * prompt-cache safe. Hover tooltips with the exact time (#70450) are NOT
 * gated — they add no visual noise until the user asks for them.
 */

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const DISPLAY_TIMESTAMPS_KEY = 'anakot.desktop.displayTimestamps'

export const $displayTimestamps = atom<boolean>(storedBoolean(DISPLAY_TIMESTAMPS_KEY, false))

export function setDisplayTimestamps(show: boolean): void {
  persistBoolean(DISPLAY_TIMESTAMPS_KEY, show)
  $displayTimestamps.set(show)
}

export function setDisplayTimestampsFromConfig(value: unknown): void {
  const enabled = value === true || value === 'true' || value === 1
  $displayTimestamps.set(enabled)
}