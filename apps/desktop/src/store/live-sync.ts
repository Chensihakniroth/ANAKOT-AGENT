// Live sync — event-driven backend data change signals.
// Mirrors Hermes live-sync: tick atoms that surfaces subscribe to for refresh.

import { atom } from 'nanostores'

export const $changeEventsAvailable = atom(false)
export const $cronChangeTick = atom(0)
export const $sessionsChangeTick = atom(0)
export const $platformsChangeTick = atom(0)
export const $pairingChangeTick = atom(0)

export interface PetChangeMeta {
  enabled: boolean
  slug?: string
  displayName?: string
  scale?: number
  spritesheetRevision?: string
}

export const $petChange = atom<{ meta?: PetChangeMeta; tick: number }>({ tick: 0 })

export function setChangeEventsAvailable(available: boolean): void { $changeEventsAvailable.set(available) }
export function notifyPetChanged(meta?: PetChangeMeta): void { $petChange.set({ meta, tick: $petChange.get().tick + 1 }) }
export function notifyCronChanged(): void { $cronChangeTick.set($cronChangeTick.get() + 1) }
export function notifySessionsChanged(): void { $sessionsChangeTick.set($sessionsChangeTick.get() + 1) }
export function notifyPlatformsChanged(): void { $platformsChangeTick.set($platformsChangeTick.get() + 1) }
export function notifyPairingChanged(): void { $pairingChangeTick.set($pairingChangeTick.get() + 1) }
export function resetLiveSync(): void { $changeEventsAvailable.set(false) }
