// Window zoom state tracking — tracks the current zoom level (0-100%) and
// whether pinch/zoom gestures are enabled. Used for zoom-aware UI scaling.

import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.zoom.level'
const ENABLE_KEY = 'anakot.desktop.zoom.enabled'

export interface ZoomState {
  level: number // 50–200, default 100
  enabled: boolean
}

function clampZoom(level: number): number {
  return Math.min(200, Math.max(50, level))
}

function load(): ZoomState {
  const raw = storedString(STORAGE_KEY)
  if (!raw) return { level: 100, enabled: false }
  try {
    const parsed = JSON.parse(raw)
    return {
      level: clampZoom(typeof parsed.level === 'number' ? parsed.level : 100),
      enabled: Boolean(parsed.enabled),
    }
  } catch {
    return { level: 100, enabled: false }
  }
}

export const $zoomState = atom<ZoomState>(load())

$zoomState.subscribe(value => persistString(STORAGE_KEY, JSON.stringify(value)))

export function setZoomLevel(level: number): void {
  $zoomState.set({ ...$zoomState.get(), level: clampZoom(level) })
}

export function setZoomEnabled(enabled: boolean): void {
  $zoomState.set({ ...$zoomState.get(), enabled })
}

export function zoomIn(): void {
  const current = $zoomState.get().level
  setZoomLevel(Math.min(200, current + 10))
}

export function zoomOut(): void {
  const current = $zoomState.get().level
  setZoomLevel(Math.max(50, current - 10))
}

export function resetZoom(): void {
  $zoomState.set({ ...$zoomState.get(), level: 100 })
}
