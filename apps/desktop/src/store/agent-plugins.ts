// Agent plugins — ported from Hermes
import { atom } from 'nanostores'

export interface AgentPlugin { id: string; name: string; enabled: boolean; description?: string }
export const $skills = atom<AgentPlugin[]>([])
export const $agentPlugins = atom<AgentPlugin[]>([])

export function installSkill(_id: string): Promise<boolean> {
  return Promise.resolve(false)
}

export function toggleSkill(id: string) {
  $skills.set($skills.get().map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
}

export function setAgentPlugins(plugins: AgentPlugin[]) {
  $agentPlugins.set(plugins)
}
