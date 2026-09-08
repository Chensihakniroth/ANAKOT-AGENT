import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.keepAwake'

export const $keepAwake = atom(storedBoolean(STORAGE_KEY, false))

$keepAwake.subscribe(enabled => {
  persistBoolean(STORAGE_KEY, enabled)
  void window.anakotDesktop?.setKeepAwake?.(enabled)
})

export function setKeepAwake(enabled: boolean): void {
  $keepAwake.set(enabled)
}
