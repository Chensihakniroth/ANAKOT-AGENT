// Provider collapse — tracks which provider slugs are collapsed in the model picker.
// Persisted globally (presentation preference, not per-profile).

import { atom } from 'nanostores'

import { persistStringArray, storedStringArray } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.collapsed-providers'

export const $collapsedProviders = atom<string[]>(storedStringArray(STORAGE_KEY) ?? [])
$collapsedProviders.subscribe(v => persistStringArray(STORAGE_KEY, [...v]))

export function toggleCollapsedProvider(slug: string): void {
  const current = $collapsedProviders.get()
  $collapsedProviders.set(current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug])
}
