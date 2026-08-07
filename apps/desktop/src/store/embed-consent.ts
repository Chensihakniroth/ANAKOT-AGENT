import { atom } from 'nanostores'

import { persistString, persistStringArray, storedString, storedStringArray } from '@/lib/storage'

// Privacy gate for inline embeds. Loading an embed reaches out to a third party
// (IP, referrer, cookies), so by default we render a placeholder until the user
// consents — per embed ("Load once") or per service ("Always allow YouTube").
// Purely client-side (the renderer is what makes the request), so it never
// touches the gateway/config.yaml.
export type EmbedMode = 'always' | 'ask' | 'off'

const MODE_KEY = 'anakot.desktop.embed-mode'
const ALLOWED_KEY = 'anakot.desktop.embed-allowed'

function readMode(): EmbedMode {
  const raw = storedString(MODE_KEY)

  return raw === 'always' || raw === 'off' ? raw : 'ask'
}

/** Global default: ask (placeholder), always (auto-load), off (plain link). */
export const $embedMode = atom<EmbedMode>(readMode())
/** Providers granted a standing "always allow" (e.g. `youtube`, `twitter`). */
export const $embedAllowed = atom<string[]>(storedStringArray(ALLOWED_KEY))

$embedMode.subscribe(value => {
  persistString(MODE_KEY, value)
})

$embedAllowed.subscribe(value => {
  persistStringArray(ALLOWED_KEY, [...value])
})

export function allowProvider(provider: string) {
  const current = $embedAllowed.get()

  if (!current.includes(provider)) {
    $embedAllowed.set([...current, provider])
  }
}

export function setEmbedMode(mode: EmbedMode) {
  $embedMode.set(mode)
}

export function clearEmbedAllowed() {
  $embedAllowed.set([])
}
