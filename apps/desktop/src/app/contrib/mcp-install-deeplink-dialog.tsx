// MCP install deeplink dialog — triggered by `anakot://mcp/install?...` URIs.

import { useStore } from '@nanostores/react'
import { type FC, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { $pendingMcpInstall, clearPendingMcpInstall } from '@/store/mcp-deeplink-install'
import { notify } from '@/store/notifications'
import { cn } from '@/lib/utils'

interface McpInstallDeeplinkDialogProps {
  className?: string
}

/** Modal that appears when an MCP install deeplink is received. */
export const McpInstallDeeplinkDialog: FC<McpInstallDeeplinkDialogProps> = ({ className }) => {
  const pending = useStore($pendingMcpInstall)

  useEffect(() => {
    if (pending) {
      notify({ kind: 'info', message: `MCP install requested: ${pending.serverName ?? pending.sourceUrl}` })
    }
  }, [pending])

  if (!pending) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className,
      )}
      onClick={clearPendingMcpInstall}
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={clearPendingMcpInstall}>
            Cancel
          </Button>
          <Button onClick={() => {
            // TODO: trigger actual install via IPC
            clearPendingMcpInstall()
          }}>
            Install
          </Button>
        </div>
      </div>
    </div>
  )
}
