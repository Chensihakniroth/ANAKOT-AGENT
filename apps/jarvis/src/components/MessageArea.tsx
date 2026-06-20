import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface MessageAreaProps {
  messages: Message[]
  state: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function useAutoScroll(dep: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const rafRef = useRef(0)

  const pinToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      atBottomRef.current =
        el.scrollHeight - (el.scrollTop + el.clientHeight) <= 8
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (atBottomRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(pinToBottom)
    }
  }, [dep, pinToBottom])

  return scrollRef
}

// ── Streaming Text (smooth character reveal) ─────────────────────────────────

const REVEAL_DRAIN_MS = 500
const REVEAL_MAX_CHARS_PER_FRAME = 30

function StreamingText({ text, isRunning }: { text: string; isRunning: boolean }) {
  const [displayed, setDisplayed] = useState(isRunning ? '' : text)
  const targetRef = useRef(text)
  const shownRef = useRef(displayed)
  const frameRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)

  shownRef.current = displayed
  targetRef.current = text

  useEffect(() => {
    if (!text.startsWith(shownRef.current)) {
      shownRef.current = isRunning ? '' : text
      setDisplayed(shownRef.current)
    }
    if (shownRef.current.length >= text.length || frameRef.current !== null) return

    lastTickRef.current = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      const remaining = targetRef.current.length - shownRef.current.length
      const add = Math.min(
        remaining,
        REVEAL_MAX_CHARS_PER_FRAME,
        Math.max(1, Math.ceil((remaining * dt) / REVEAL_DRAIN_MS))
      )
      shownRef.current = targetRef.current.slice(0, shownRef.current.length + add)
      setDisplayed(shownRef.current)
      frameRef.current =
        shownRef.current.length < targetRef.current.length
          ? requestAnimationFrame(tick)
          : null
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [text, isRunning])

  return <>{displayed}</>
}

// ── Message Bubbles ──────────────────────────────────────────────────────────

const userBubbleStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0d1f2a 0%, #0a1520 100%)',
  border: '1px solid rgba(0, 229, 255, 0.2)',
  borderRadius: '0.75rem',
  borderTopRightRadius: '0.25rem',
  padding: '0.625rem 0.875rem',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  color: 'var(--j-text-primary)',
  overflowWrap: 'anywhere',
}

const assistantBubbleStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #12121e 0%, #0e0e1a 100%)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '0.75rem',
  borderTopLeftRadius: '0.25rem',
  padding: '0.625rem 0.875rem',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  color: 'var(--j-text-primary)',
  overflowWrap: 'anywhere',
}

function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex flex-col items-end gap-1 animate-fade-in" style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
      <div className="flex items-center gap-2 px-1" style={{ alignSelf: 'flex-end' }}>
        <span style={{ fontSize: '0.625rem', color: 'rgba(255, 215, 64, 0.6)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(message.timestamp)}
        </span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'rgba(0, 229, 255, 0.8)' }}>You</span>
      </div>
      <div style={userBubbleStyle}>
        <span style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{message.content}</span>
      </div>
    </div>
  )
}

function AssistantMessage({ message, isLatest, isRunning }: { message: Message; isLatest: boolean; isRunning: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1 animate-fade-in" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
      <div className="flex items-center gap-2 px-1" style={{ alignSelf: 'flex-start' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'rgba(255, 215, 64, 0.8)' }}>J.A.R.V.I.S.</span>
        <span style={{ fontSize: '0.625rem', color: 'rgba(90, 90, 112, 0.6)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div style={assistantBubbleStyle}>
        {isLatest && isRunning ? (
          <StreamingText text={message.content} isRunning={isRunning} />
        ) : (
          <span style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{message.content}</span>
        )}
      </div>
    </div>
  )
}

function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-center animate-fade-in" style={{ alignSelf: 'center' }}>
      <div style={{
        borderRadius: '9999px',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '0.25rem 0.75rem',
        fontSize: '0.6875rem',
        color: 'var(--j-text-tertiary)'
      }}>
        {message.content}
      </div>
    </div>
  )
}

// ── Thinking Indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 animate-fade-in" style={{ alignSelf: 'flex-start' }}>
      <div style={{
        ...assistantBubbleStyle,
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
      }}>
        <span className="dither animate-pulse" style={{
          display: 'inline-block',
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '2px',
          color: 'rgba(255, 215, 64, 0.7)',
        }} />
        <span style={{ fontSize: '0.75rem', color: 'rgba(255, 215, 64, 0.7)' }}>Thinking</span>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{
      flex: 1,
      color: 'var(--j-text-tertiary)'
    }}>
      <div style={{ fontSize: '1.75rem', opacity: 0.2 }}>⚡</div>
      <p style={{ fontSize: '0.8125rem' }}>Say something to begin...</p>
    </div>
  )
}

// ── Message Area ─────────────────────────────────────────────────────────────

export function MessageArea({ messages, state }: MessageAreaProps) {
  const scrollRef = useAutoScroll(messages.length)
  const isRunning = state === 'thinking' || state === 'speaking'
  const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant')

  return (
    <div
      ref={scrollRef}
      className="flex flex-col overflow-y-auto overscroll-contain gap-3"
      style={{ flex: 1, padding: '1rem' }}
    >
      {messages.length === 0 && <EmptyState />}

      {messages.map((msg, idx) => {
        if (msg.role === 'user') {
          return <UserMessage key={msg.id} message={msg} />
        }
        if (msg.role === 'system') {
          return <SystemMessage key={msg.id} message={msg} />
        }
        const isLatestAssistant = idx === messages.length - 1 - lastAssistantIdx
        return (
          <AssistantMessage
            key={msg.id}
            message={msg}
            isLatest={isLatestAssistant}
            isRunning={isLatestAssistant && isRunning}
          />
        )
      })}

      {state === 'thinking' && (
        messages.length === 0 ||
        messages[messages.length - 1].role !== 'assistant' ||
        !messages[messages.length - 1].content
      ) && <ThinkingIndicator />}

      <div style={{ height: '1rem', flexShrink: 0 }} aria-hidden="true" />
    </div>
  )
}
