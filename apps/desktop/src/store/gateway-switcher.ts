import { atom, map } from 'nanostores'

export interface GatewayFavorite {
  profileKey: string
  label: string
  remoteUrl?: string
  starred: boolean
}

/**
 * Per-profile favorites store. Starred gateways appear first in the
 * gateway switcher and can be quickly reconnected from the menu bar.
 */
export const $gatewayFavorites = map<Record<string, GatewayFavorite>>({})

export function setGatewayFavoriteStarred(profileKey: string, starred: boolean): void {
  const favorites = $gatewayFavorites.get()
  const existing = favorites[profileKey]
  if (existing) {
    $gatewayFavorites.set({ ...favorites, [profileKey]: { ...existing, starred } })
  } else {
    $gatewayFavorites.set({ ...favorites, [profileKey]: { profileKey, label: profileKey, starred } })
  }
}

export function removeGatewayFavorite(profileKey: string): void {
  const favorites = $gatewayFavorites.get()
  const { [profileKey]: _, ...rest } = favorites
  $gatewayFavorites.set(rest)
}

export function getStarredGatewayProfiles(): string[] {
  return Object.values($gatewayFavorites.get())
    .filter(f => f.starred)
    .map(f => f.profileKey)
    .sort()
}