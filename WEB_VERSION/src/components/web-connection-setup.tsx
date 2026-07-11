/**
 * Web Connection Setup — landing page for the web version of Anakot.
 *
 * When no backend is connected, this screen replaces the dead "Gateway offline"
 * state with a clean setup flow: enter backend URL → test connection → go.
 *
 * Also offers a "Demo mode" link so friends can browse the UI without a backend.
 */
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ShaderBackground } from '@/components/ui/shader-background'
import { $gatewayState } from '@/store/session'
import {
  $webConnection,
  setWebBackendUrl,
  setWebConnected,
  setWebConnecting,
  setWebConnectionError,
} from '@/store/web-connection'

// ── Connection test ────────────────────────────────────────────────────────

async function testBackendConnection(url: string): Promise<string | null> {
  // Try a GET to the health/status endpoint (best-effort).
  try {
    const res = await fetch(`${url}/api/health`, { method: 'GET', signal: AbortSignal.timeout(5000) })
    if (res.ok) return null
    return `Backend returned ${res.status}`
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function WebConnectionSetup() {
  const web = useStore($webConnection)
  const gatewayState = useStore($gatewayState)
  const [urlInput, setUrlInput] = useState(web.backendUrl)

  // If the gateway is already open, don't show this
  if (gatewayState === 'open') return null

  const handleTest = async () => {
    setWebConnecting(true)
    setWebConnectionError(null)
    setWebBackendUrl(urlInput)

    const err = await testBackendConnection(urlInput)
    if (err) {
      setWebConnectionError(err)
    } else {
      setWebConnected(true)
      // Reload so the gateway boot picks up the new URL from localStorage
      setTimeout(() => window.location.reload(), 600)
    }
  }

  const handleDemo = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('demo', '1')
    window.location.href = url.href
  }

  return (
    <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center bg-background p-6">
      <ShaderBackground className="pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-(--theme-primary)/10">
            <BrandMark className="size-10 text-(--theme-primary)" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Anakot Agent</h1>
          <p className="text-center text-sm text-muted-foreground">
            Connect to a backend to start chatting, or explore the interface in demo mode.
          </p>
        </div>

        {/* Connection Form */}
        <div className="flex w-full flex-col gap-3 rounded-xl border border-(--stroke-nous) bg-(--ui-chat-bubble-background) p-5 shadow-sm">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="backend-url">
            Backend URL
          </label>
          <input
            id="backend-url"
            className="w-full rounded-lg border border-(--stroke-nous) bg-(--ui-chat-surface-background) px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-(--theme-primary) focus:outline-none"
            placeholder="http://192.168.1.42:7890"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !web.connecting) void handleTest() }}
          />

          {/* Status / Error */}
          {web.error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <Codicon name="error" className="size-3 shrink-0" />
              <span>{web.error}</span>
            </div>
          )}

          {web.connected && (
            <div className="flex items-center gap-2 rounded-lg bg-(--theme-primary)/10 px-3 py-2 text-xs text-(--theme-primary)">
              <Codicon name="check" className="size-3 shrink-0" />
              <span>Connected! Reloading…</span>
            </div>
          )}

          <Button
            className="w-full"
            disabled={web.connecting || !urlInput.trim()}
            onClick={() => void handleTest()}
          >
            {web.connecting ? (
              <>
                <Codicon name="loading" className="mr-1.5 size-3.5 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Codicon name="plug" className="mr-1.5 size-3.5" />
                Connect
              </>
            )}
          </Button>
        </div>

        {/* Demo link */}
        <button
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={handleDemo}
        >
          Or explore in Demo mode →
        </button>
      </div>
    </div>
  )
}
