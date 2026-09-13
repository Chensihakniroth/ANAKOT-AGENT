import { atom } from 'nanostores'
export interface AgentNoticePayload { kind: string; message: string; sessionId?: string | null }
export const $agentNotices = atom<AgentNoticePayload[]>([])
export function pushAgentNotice(notice: AgentNoticePayload) {
  $agentNotices.set([...$agentNotices.get(), notice])
}
export function dismissAgentNotice(id: string) {
  $agentNotices.set($agentNotices.get().filter(n => n.message !== id))
}