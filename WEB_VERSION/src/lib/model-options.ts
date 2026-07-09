import { getGlobalModelOptions, type AnakotGateway, type ModelOptionsResponse } from '@/anakot'

interface ModelOptionsRequest {
  gateway?: AnakotGateway
  refresh?: boolean
  sessionId?: null | string
}

/**
 * Fetch model options, preferring the gateway connection when available.
 *
 * Gateway-first even with no session yet: a connected (possibly remote)
 * gateway owns the model catalog, including virtual providers like `moa`
 * that the local REST fallback can't know about. Falls back to the local
 * REST /api/model/options when no gateway is available.
 */
export function requestModelOptions({
  gateway,
  refresh = false,
  sessionId
}: ModelOptionsRequest): Promise<ModelOptionsResponse> {
  if (gateway) {
    const params: Record<string, unknown> = {}

    if (sessionId) {
      params.session_id = sessionId
    }

    if (refresh) {
      params.refresh = true
    }

    return gateway.request<ModelOptionsResponse>('model.options', params)
  }

  return getGlobalModelOptions()
}
