'use client'

/**
 * Deep link listener — routes `anakot://` URIs to the right handler.
 *
 * Currently handles:
 *   - `anakot://mcp/install?url=...&name=...` → MCP install dialog
 *
 * Register new route handlers in the `handleDeepLink` switch.
 */
import { useEffect } from 'react'

import { parseMcpDeeplink } from '@/lib/mcp-deeplink'
import { requestMcpInstall } from '@/store/mcp-deeplink-install'

export function useDeepLinkListener(): void {
  useEffect(() => {
    const api = window.anakotDesktop?.deepLink
    if (!api) {
      return
    }

    // Tell the main process we're ready to receive deep links
    void api.ready()

    const unsubscribe = api.onDeepLink((url: string) => {
      const mcp = parseMcpDeeplink(url)
      if (mcp.action === 'install') {
        requestMcpInstall(mcp.sourceUrl ?? '', mcp.serverName)
      }
      // Add more route handlers here as needed
    })

    return unsubscribe
  }, [])
}
