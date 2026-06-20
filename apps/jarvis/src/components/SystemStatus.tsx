// ── System Status Panel ──────────────────────────────────────────────────────

interface SystemStatusProps {
  gateway: { running: boolean; port: number }
}

export function SystemStatus({ gateway }: SystemStatusProps) {
  return (
    <>
      <StatusSection title="CONTEXT">
        <div className="flex items-center gap-2">
          <div style={{
            flex: 1,
            height: 6,
            borderRadius: 4,
            overflow: 'hidden',
            background: 'var(--j-border-secondary)',
          }}>
            <div style={{
              width: '0%',
              height: '100%',
              borderRadius: 4,
              background: 'linear-gradient(90deg, var(--j-cyan), var(--j-gold))',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--j-text-tertiary)' }}>0%</span>
        </div>
        <p style={{ fontSize: '0.625rem', color: 'var(--j-text-quaternary)', marginTop: 4 }}>0 / 200K tokens</p>
      </StatusSection>

      <StatusSection title="COST">
        <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--j-green)' }}>$0.0000</div>
        <p style={{ fontSize: '0.625rem', color: 'var(--j-text-quaternary)' }}>this session</p>
      </StatusSection>

      <StatusSection title="TOOLS">
        <p style={{ fontSize: '0.75rem', color: 'var(--j-text-tertiary)' }}>No active tools</p>
      </StatusSection>

      <StatusSection title="TERMINALS">
        <p style={{ fontSize: '0.75rem', color: 'var(--j-text-tertiary)' }}>No open terminals</p>
      </StatusSection>

      <StatusSection title="SUB-AGENTS">
        <p style={{ fontSize: '0.75rem', color: 'var(--j-text-tertiary)' }}>No active sub-agents</p>
      </StatusSection>

      <StatusSection title="GATEWAY">
        <div className="flex items-center gap-1.5">
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: gateway.running ? 'var(--j-green)' : 'var(--j-red)',
            boxShadow: gateway.running
              ? '0 0 6px var(--j-green-dim)'
              : '0 0 6px var(--j-red-dim)',
          }} />
          <span style={{
            fontSize: '0.75rem',
            color: gateway.running ? 'var(--j-green)' : 'var(--j-red)',
          }}>
            {gateway.running ? `Running (port ${gateway.port})` : 'Offline'}
          </span>
        </div>
      </StatusSection>
    </>
  )
}

// ── Section Component ────────────────────────────────────────────────────────

interface StatusSectionProps {
  title: string
  children: React.ReactNode
}

function StatusSection({ title, children }: StatusSectionProps) {
  return (
    <div style={{
      background: 'var(--j-bg-elevated)',
      border: '1px solid var(--j-border-secondary)',
      borderRadius: 8,
      padding: '0.625rem 0.75rem',
    }}>
      <div style={{
        fontSize: '0.625rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'var(--j-text-tertiary)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
