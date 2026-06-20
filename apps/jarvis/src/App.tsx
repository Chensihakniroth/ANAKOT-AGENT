import { useState, useEffect, useCallback } from 'react'
import { CircularVisualizer } from './components/CircularVisualizer'
import { TopBar } from './components/TopBar'
import { MessageArea } from './components/MessageArea'
import { SystemStatus } from './components/SystemStatus'
import { BottomToolbar } from './components/BottomToolbar'

// ── Types ────────────────────────────────────────────────────────────────────

interface GatewayInfo {
  running: boolean
  port: number
  ticket: string
  url?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

type AppState = 'booting' | 'ready' | 'listening' | 'speaking' | 'thinking' | 'error'

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [gateway, setGateway] = useState<GatewayInfo>({ running: false, port: 0, ticket: '' })
  const [state, setState] = useState<AppState>('booting')
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)

  // Start gateway on mount
  useEffect(() => {
    startGateway()
    return () => {
      window.jarvisAPI?.stopGateway()
    }
  }, [])

  // Listen for gateway exit
  useEffect(() => {
    const handler = (data: { code: number | null; signal: string | null }) => {
      console.log('[App] Gateway exited:', data)
      setGateway({ running: false, port: 0, ticket: '' })
      setState('error')
      setError(`Gateway exited (code: ${data.code}, signal: ${data.signal})`)
    }
    window.jarvisAPI?.onGatewayExit(handler)
    return () => {
      window.jarvisAPI?.removeAllListeners?.('gateway-exit')
    }
  }, [])

  const startGateway = useCallback(async () => {
    try {
      setState('booting')
      setError(null)
      const result = await window.jarvisAPI?.startGateway()
      if (result?.ok) {
        setGateway({ running: true, port: result.port, ticket: result.ticket, url: result.url })
        setState('ready')
        addMessage('system', 'J.A.R.V.I.S. online. All systems operational.')
      } else {
        setState('error')
        setError(result?.error || 'Failed to start gateway')
      }
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: Date.now()
    }])
  }, [])

  const handleSendText = useCallback(async (text: string) => {
    if (!text.trim()) return
    addMessage('user', text)
    setState('thinking')
    // TODO: Send to agent via gateway WebSocket
    // For now, echo back
    setTimeout(() => {
      addMessage('assistant', `Received: "${text}"`)
      setState('ready')
    }, 1000)
  }, [addMessage])

  const handleVoiceToggle = useCallback(() => {
    if (state === 'listening') {
      setState('ready')
    } else {
      setState('listening')
    }
  }, [state])

  return (
    <div className="hud-container">
      {/* Top Bar */}
      <TopBar
        state={state}
        gateway={gateway}
        messageCount={messages.filter(m => m.role === 'user').length}
      />

      {/* Main Content */}
      <div className="hud-main">
        {/* Left Panel — Conversation */}
        <div className="hud-left">
          {/* Header strip — Arc Reactor + Identity */}
          <div
            className="flex items-center gap-4 shrink-0"
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--j-border-secondary)',
              background: 'var(--j-bg-elevated)'
            }}
          >
            <CircularVisualizer state={state} size={72} />
            <div className="flex flex-col gap-1">
              <h2
                className="hud-text-glow-cyan text-lg font-bold tracking-[0.04em] text-jarvis-cyan"
              >
                J.A.R.V.I.S.
              </h2>
              <span
                className="text-[0.75rem]"
                style={{ color: gateway.running ? 'var(--j-green)' : 'var(--j-red)' }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle"
                  style={{
                    background: gateway.running ? 'var(--j-green)' : 'var(--j-red)'
                  }}
                />
                {gateway.running ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Chat history */}
          <MessageArea messages={messages} state={state} />
        </div>

        {/* Right Panel — System Status */}
        <div className="hud-right">
          <SystemStatus gateway={gateway} />
        </div>
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar
        state={state}
        onVoiceToggle={handleVoiceToggle}
        onSendText={handleSendText}
        error={error}
        onRetry={startGateway}
      />
    </div>
  )
}
