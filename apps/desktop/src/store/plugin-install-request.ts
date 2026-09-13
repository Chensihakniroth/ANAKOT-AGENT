import { atom } from 'nanostores'
// Plugin install request — ported from Hermes
export const $pluginInstallRequests = atom<Array<{ id: string; status: string }>>([])
export function requestPluginInstall(pluginId: string): string {
  const id = crypto.randomUUID()
  $pluginInstallRequests.set([...$pluginInstallRequests.get(), { id, status: 'pending' }])
  return id
}