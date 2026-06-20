// ── Top Bar ──────────────────────────────────────────────────────────────────

interface TopBarProps {
  state: string
  gateway: { running: boolean; port: number }
  messageCount: number
}

export function TopBar({ state, gateway, messageCount }: TopBarProps) {
  const stateLabel: Record<string, string> = {
    booting: 'Booting...',
    ready: 'Ready',
    listening: 'Listening...',
    speaking: 'Speaking...',
    thinking: 'Thinking...',
    error: 'Error'
  }

  const stateColor: Record<string, string> = {
    booting: 'var(--j-gold)',
    ready: 'var(--j-green)',
    listening: 'var(--j-cyan)',
    speaking: 'var(--j-cyan)',
    thinking: 'var(--j-gold)',
    error: 'var(--j-red)'
  }

  return (
    <div className="flex items-center justify-between shrink-0"
         style={{
           height: 36,
           padding: '0 1rem',
           borderBottom: '1px solid var(--j-border-secondary)',
           background: 'var(--j-bg-elevated)'
         }}>
      {/* Left: Identity */}
      <div className="flex items-center gap-3">
        <span className="hud-text-glow-cyan" style={{
          fontSize: '0.875rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--j-cyan)'
        }}>
          J.A.R.V.I.S.
        </span>
        <span style={{ fontSize: '0.6875rem', color: stateColor[state] || 'var(--j-text-tertiary)' }}>
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            marginRight: 6,
            verticalAlign: 'middle',
            background: stateColor[state] || 'var(--j-text-tertiary)'
          }} />
          {stateLabel[state] || state}
        </span>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4" style={{ fontSize: '0.6875rem', color: 'var(--j-text-tertiary)' }}>
        <span>{messageCount} messages</span>
        <span style={{ color: gateway.running ? 'var(--j-green)' : 'var(--j-red)' }}>
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            marginRight: 6,
            verticalAlign: 'middle',
            background: gateway.running ? 'var(--j-green)' : 'var(--j-red)'
          }} />
          {gateway.running ? `Gateway :${gateway.port}` : 'Gateway offline'}
        </span>
      </div>
    </div>
  )
}
