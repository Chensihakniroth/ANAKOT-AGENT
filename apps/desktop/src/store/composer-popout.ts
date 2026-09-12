// Composer popout store — detach composer into a floating window with persisted position.

import { atom, computed, type ReadableAtom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const POPOUT_STORAGE_KEY = 'anakot.desktop.composerPopout.zones.v1'

/** Where the floating composer's bottom-right corner sits. */
export interface PopoutPosition {
  bottom: number
  right: number
}

export interface PopoutZoneState {
  poppedOut: boolean
  position: PopoutPosition
}

function load(): Record<string, PopoutZoneState> {
  const raw = storedString(POPOUT_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const $popoutZones = atom<Record<string, PopoutZoneState>>(load())

$popoutZones.subscribe(value => persistString(POPOUT_STORAGE_KEY, JSON.stringify(value)))

export function setPopoutState(zoneId: string, state: PopoutZoneState): void {
  $popoutZones.set({ ...$popoutZones.get(), [zoneId]: state })
}

export function getPopoutState(zoneId: string): PopoutZoneState {
  return $popoutZones.get()[zoneId] ?? { poppedOut: false, position: { bottom: 24, right: 24 } }
}

export function isPopoutActive(zoneId: string): ReadableAtom<boolean> {
  return computed($popoutZones, zones => zones[zoneId]?.poppedOut ?? false)
}

export function popIn(zoneId: string): void {
  const current = getPopoutState(zoneId)
  setPopoutState(zoneId, { ...current, poppedOut: false })
}

export function popOut(zoneId: string): void {
  const current = getPopoutState(zoneId)
  setPopoutState(zoneId, { ...current, poppedOut: true })
}
