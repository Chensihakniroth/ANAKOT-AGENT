import { atom } from 'nanostores'

import { storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.settingsScopeProfile'

// When set, settings pages edit this profile's config instead of the active one.
// null = follow the active gateway profile (default behavior).
export const $settingsScopeOverride = atom<string | null>(storedString(STORAGE_KEY))

export function setSettingsScope(profile: string | null): void {
  $settingsScopeOverride.set(profile || null)
}

export function clearSettingsScope(): void {
  $settingsScopeOverride.set(null)
}
