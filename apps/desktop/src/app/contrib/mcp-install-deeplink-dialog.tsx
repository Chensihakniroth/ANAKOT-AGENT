// MCP install deeplink dialog — triggered by `anakot://mcp/install?...` URIs.

import { useStore } from '@nanostores/react'
import { type FC, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getAnakotConfigRecord, saveAnakotConfig } from '@/anakot'
import { $pendingMcpInstall, clearPendingMcpInstall } from '@/store/mcp-deeplink-install'
import { notify } from '@/store/notifications'
import { cn } from '@/lib/utils'

interface McpInstallDeeplinkDialogProps {
  className?: string
}

type McpServerEntry = Record<string, unknown>

/**
 * Fetch the MCP server config from the source URL. Expects a JSON response
 * that is either { name, config: {...} } or the raw server config object.
 */
async function fetchServerConfig(url: string): Promise<{ name: string; config: McpServerEntry }> {
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Failed to fetch config: ${res.status}`)
  }

  const data = (await res.json()) as Record<string, unknown>

  // Shape: { name: "foo", config: { command: "...", args: [...] } }
  if (data.config && typeof data.config === 'object') {
    return {
      name: typeof data.name === 'string' ? data.name : 'imported-server',
      config: data.config as McpServerEntry,
    }
  }

  // Shape: raw server config — caller must provide name via deeplink param
  return {
    name: 'imported-server',
    config: data,
  }
}

/** Modal that appears when an MCP install deeplink is received. */
export const McpInstallDeeplinkDialog: FC<McpInstallDeeplinkDialogProps> = ({ className }) => {
  const pending = useStore($pendingMcpInstall)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!pending) {
    return null
  }

  const close = () => {
    if (!installing) {
      clearPendingMcpInstall()
    }
  }

  const install = async () => {
    if (installing) {
      return
    }

    setInstalling(true)
    setError(null)

    try {
      const { name: fetchedName, config } = await fetchServerConfig(pending.sourceUrl)
      const serverName = pending.serverName || fetchedName

      // Fetch current config and merge the new server in
      const current = await getAnakotConfigRecord()
      const currentServers = (current?.mcp_servers as Record<string, McpServerEntry>) ?? {}
      const nextConfig = {
        ...current,
        mcp_servers: {
          ...currentServers,
          [serverName]: config,
        },
      }

      const result = await saveAnakotConfig(nextConfig)

      if (!result.ok) {
        throw new Error('Save failed')
      }

      notify({
        kind: 'success',
        message: `MCP server "${serverName}" installed successfully`,
      })
      clearPendingMcpInstall()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Install failed: ${message}`)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className,
      )}
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold">Install MCP Server</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {pending.serverName ?? 'A plugin'} wants to install an MCP server from:
        </p>
        <p className="mb-4 truncate rounded bg-muted/30 px-2 py-1 font-mono text-xs">
          {pending.sourceUrl}
        </p>
        {error && (
          <p className="mb-4 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={installing} onClick={close}>
            Cancel
          </Button>
          <Button onClick={install} disabled={installing}>
            {installing ? 'Installing...' : 'Install'}
          </Button>
        </div>
      </div>
    </div>
  )
}
