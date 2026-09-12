// Desktop-local presentation preference: collapse reasoning blocks by default.
// Does NOT touch backend config — this is a per-window display choice.

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.reasoning.collapsedByDefault'

export const $reasoningCollapsedByDefault = atom(storedBoolean(STORAGE_KEY, false))

$reasoningCollapsedByDefault.subscribe(value => persistBoolean(STORAGE_KEY, value))

export function setReasoningCollapsedByDefault(value: boolean): void {
  $reasoningCollapsedByDefault.set(value)
}
