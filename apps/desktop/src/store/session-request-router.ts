import { atom } from 'nanostores'
// Session request router — full port from Hermes
export interface SessionOwnerScope { profile?: string | null; connectionId?: string | null }
export interface SessionOwnerRoute { connectionId?: string | null; profile?: string | null }
export interface SessionProfileRoute { profile?: string | null }
export interface SessionRequestRouterConfig {
  defaultProfile: string
  resolveOwner: (sessionId: string) => SessionOwnerScope | null
}
export const $sessionRequestRouterConfig = atom<SessionRequestRouterConfig>({
  defaultProfile: 'default',
  resolveOwner: () => null
})
export function requestForSessionProfile(scope: SessionProfileRoute) {
  return async <R>(method: string, params?: Record<string, unknown>): Promise<R> => {
    const profile = scope.profile ?? $sessionRequestRouterConfig.get().defaultProfile
    const gateway = (window as any).anakotDesktop?.gateway
    if (!gateway) return {} as R
    return gateway.request(method, { ...params, profile }) as Promise<R>
  }
}
export function requestForOwnedSession(scope: SessionOwnerScope) {
  return async <R>(method: string, params?: Record<string, unknown>): Promise<R> => {
    const gateway = (window as any).anakotDesktop?.gateway
    if (!gateway) return {} as R
    return gateway.request(method, { ...params, ...scope }) as Promise<R>
  }
}
export function setSessionRequestRouterConfig(config: Partial<SessionRequestRouterConfig>) {
  $sessionRequestRouterConfig.set({ ...$sessionRequestRouterConfig.get(), ...config })
}