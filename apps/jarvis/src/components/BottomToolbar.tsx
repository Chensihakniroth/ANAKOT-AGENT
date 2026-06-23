import { useState } from 'react'

// ── Bottom Toolbar ───────────────────────────────────────────────────────────

interface BottomToolbarProps {
  state: string
  onVoiceToggle: () => void
  onSendText: (text: string) => void
  error: string | null
  onRetry: () => void
}

export function BottomToolbar({ state, onVoiceToggle, onSendText, error, onRetry }: BottomToolbarProps) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (text.trim()) {
      onSendText(text.trim())
      setText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isListening = state === 'listening'
  const isThinking  = state === 'thinking'
  const isSpeaking  = state === 'speaking'

  return (
    <div className="flex items-center gap-2 shrink-0"
         style={{
           height: 'var(--j-composer-height)',
           padding: '0 1rem',
           borderTop: '1px solid var(--j-border-secondary)',
           background: 'var(--j-bg-elevated)',
         }}>

      {/* Voice Toggle */}
      <button
        onClick={onVoiceToggle}
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          border: 'none',
          background: isListening ? 'var(--j-cyan-dim)' : 'var(--j-bg-input)',
          color: isListening ? 'var(--j-cyan)' : 'var(--j-text-tertiary)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          transition: 'all 0.2s',
          boxShadow: isListening ? '0 0 12px var(--j-cyan-glow)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={isListening ? 'Stop listening' : 'Start voice'}
      >
        {isListening ? '⏹' : '🎤'}
      </button>

      {/* Status indicators */}
      {isSpeaking && (
        <span className="animate-breathe" style={{ fontSize: '0.75rem', color: 'var(--j-cyan)' }}>
          🔊 Speaking...
        </span>
      )}
      {isThinking && (
        <span className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--j-gold)' }}>
          <span className="dither animate-pulse" style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: 2,
          }} />
          Thinking
        </span>
      )}

      {/* Error + Retry */}
      {error && (
        <>
          <span style={{ fontSize: '0.6875rem', color: 'var(--j-red)' }}>⚠ {error}</span>
          <button
            onClick={onRetry}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid var(--j-red)',
              background: 'transparent',
              color: 'var(--j-red)',
              cursor: 'pointer',
              fontSize: '0.6875rem',
            }}
          >
            Retry
          </button>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Text Input */}
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        style={{
          height: 30,
          width: 260,
          borderRadius: 8,
          border: '1px solid var(--j-border-secondary)',
          background: 'var(--j-bg-input)',
          color: 'var(--j-text-primary)',
          fontSize: '0.8125rem',
          padding: '0 0.75rem',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(0, 229, 255, 0.4)'}
        onBlur={e => e.target.style.borderColor = 'var(--j-border-secondary)'}
      />

      {/* Send Button */}
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        style={{
          height: 30,
          borderRadius: 8,
          border: 'none',
          padding: '0 0.75rem',
          background: text.trim() ? 'var(--j-cyan)' : 'var(--j-bg-input)',
          color: text.trim() ? 'var(--j-bg-chrome)' : 'var(--j-text-quaternary)',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          fontSize: '0.8125rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          opacity: text.trim() ? 1 : 0.6,
        }}
      >
        Send
      </button>
    </div>
  )
}
