import { useEffect, useState } from 'react'

// ── Arc Reactor ──────────────────────────────────────────────────────────────

interface ArcReactorProps {
  size?: number
  color?: string
  pulsing?: boolean
}

export function ArcReactor({ size = 60, color = '#00e5ff', pulsing = true }: ArcReactorProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pulsing) return
    const id = setInterval(() => setTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [pulsing])

  const glowIntensity = 0.3 + Math.sin(tick * 0.15) * 0.2
  const innerGlow = 0.5 + Math.sin(tick * 0.2) * 0.3

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Outer glow */}
      <defs>
        <radialGradient id="reactorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={glowIntensity} />
          <stop offset="60%" stopColor={color} stopOpacity={glowIntensity * 0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="reactorCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={innerGlow} />
          <stop offset="40%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" />

      {/* Glow layer */}
      <circle cx="50" cy="50" r="35" fill="url(#reactorGlow)" />

      {/* Spinning arc segments */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rotation = angle + tick * (2 + i * 0.5)
        return (
          <circle
            key={i}
            cx="50"
            cy="50"
            r="30"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="8 12"
            strokeLinecap="round"
            opacity={0.4 + Math.sin(tick * 0.1 + i) * 0.2}
            transform={`rotate(${rotation} 50 50)`}
            filter="url(#glow)"
          />
        )
      })}

      {/* Inner ring */}
      <circle cx="50" cy="50" r="20" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />

      {/* Core */}
      <circle cx="50" cy="50" r="12" fill="url(#reactorCore)" filter="url(#glow)" />

      {/* Center dot */}
      <circle cx="50" cy="50" r="4" fill="#ffffff" opacity={innerGlow} />
    </svg>
  )
}
