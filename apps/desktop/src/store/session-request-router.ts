import { atom } from 'nanostores'
// Session request router — ported from Hermes
export interface SessionOwnerScope { profile?: string | null }
export interface SessionOwnerRoute { connectionId?: string | null; profile?: string | null }
export interface SessionProfileRoute { profile?: string | null }
export function requestForSessionProfile(scope: SessionProfileRoute) {
  return async <R>(method: string, params?: Record<string, unknown>): Promise<R> => {
    return {} as R
  }
}