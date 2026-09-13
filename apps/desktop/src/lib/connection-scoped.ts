import { atom } from 'nanostores'
// Connection-scoped utilities — ported from Hermes
export function withConnectionScope<T>(connectionId: string, fn: () => T): T {
  return fn()
}