import type { AnakotGateway } from '@/anakot'

export interface ForeignSessionItem {
  handle: string
  source: string
  title: string
  path: string
  modified_at: number
  message_count: number
  cwd?: string
  preview_turns: Array<{ role: string; content: string }>
}

export interface ForeignSessionPreview {
  handle: string
  path: string
  source: string
  title: string
  total_turns: number
  preview_turns: Array<{ role: string; content: string; truncated?: boolean; timestamp?: number }>
  modified_at: number
}

export interface ForeignSessionImportResult {
  session_id: string
  title: string
  source: string
  path: string
  message_count: number
  started_at: number
  ended_at: number
}

type GatewayRequester = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>

export async function listForeignSessions(
  requestGateway: GatewayRequester,
  limit = 50
): Promise<ForeignSessionItem[]> {
  const res = await requestGateway<{ sessions: ForeignSessionItem[] }>('session.foreign.list', { limit })
  return res.sessions || []
}

export async function previewForeignSession(
  requestGateway: GatewayRequester,
  handleOrPath: string,
  maxTurns = 40
): Promise<ForeignSessionPreview> {
  return await requestGateway<ForeignSessionPreview>('session.foreign.preview', {
    handle: handleOrPath,
    max_turns: maxTurns,
  })
}

export async function importForeignSession(
  requestGateway: GatewayRequester,
  handleOrPath: string,
  title?: string
): Promise<ForeignSessionImportResult> {
  return await requestGateway<ForeignSessionImportResult>('session.foreign.import', {
    handle: handleOrPath,
    title,
  })
}
