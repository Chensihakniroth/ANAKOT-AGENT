// Keyboard-only mode — when on, the app hides pointer-driven UI hints and
// keyboard shortcuts are surfaced more prominently. Toggleable preference.

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.keyboardOnlyMode'

export const $keyboardOnlyMode = atom(storedBoolean(STORAGE_KEY, false))
$keyboardOnlyMode.subscribe(v => persistBoolean(STORAGE_KEY, v))

export function setKeyboardOnlyMode(enabled: boolean): void { $keyboardOnlyMode.set(enabled) }
export function toggleKeyboardOnlyMode(): void { $keyboardOnlyMode.set(!$keyboardOnlyMode.get()) }
