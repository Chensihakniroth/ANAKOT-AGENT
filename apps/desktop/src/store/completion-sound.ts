import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'anakot.desktop.completionSoundEnabled'

export const $completionSoundEnabled = atom(storedString(STORAGE_KEY) !== '0')

$completionSoundEnabled.subscribe(enabled => persistString(STORAGE_KEY, enabled ? '1' : '0'))

export function setCompletionSoundEnabled(enabled: boolean): void {
  $completionSoundEnabled.set(enabled)
}
