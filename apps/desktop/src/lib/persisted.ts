import { atom, type WritableAtom } from 'nanostores'

import { persistString, storedString } from './storage'

// A nanostore that auto-persists. Reads its seed from localStorage and
// writes back on every change — no per-atom subscribe boilerplate.

export interface Codec<T> {
  decode(raw: string): T
  encode(value: T): null | string
}

export const Codecs = {
  bool: { decode: (raw: string) => raw === 'true', encode: (value: boolean) => String(value) } as Codec<boolean>,
  nullableText: { decode: (raw: string) => raw, encode: (value: null | string) => value } as Codec<null | string>,
  text: { decode: (raw: string) => raw, encode: (value: string) => value } as Codec<string>,
  stringArray: {
    decode: (raw: string) => {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []
    },
    encode: (value: string[]) => (value.length === 0 ? null : JSON.stringify(value))
  } as Codec<string[]>,
  stringRecord: {
    decode: (raw: string) => {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    },
    encode: (value: Record<string, string>) => JSON.stringify(value)
  } as Codec<Record<string, string>>,
}

export function persistentAtom<T>(key: string, fallback: T, codec: Codec<T>): WritableAtom<T> {
  const initial = storedString(key) !== null ? codec.decode(storedString(key)!) : fallback
  const store = atom<T>(initial)

  store.subscribe(value => {
    const encoded = codec.encode(value)
    persistString(key, encoded)
  })

  return store
}
