import { useEffect, useRef, useCallback } from 'react'

// ── Circular Audio Visualizer (NCS Style) ────────────────────────────────────

interface CircularVisualizerProps {
  /** Current app state */
  state: 'booting' | 'ready' | 'listening' | 'speaking' | 'thinking' | 'error'
  /** Canvas size in px */
  size?: number
  /** Audio analyser node (from Web Audio API) */
  analyser?: AnalyserNode | null
  /** Number of bars */
  barCount?: number
}

export function CircularVisualizer({
  state,
  size = 80,
  analyser = null,
  barCount = 36
}: CircularVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const dataRef = useRef<Uint8Array>(new Uint8Array(128))

  // Get target amplitude based on state
  const getTargetAmplitude = useCallback(() => {
    switch (state) {
      case 'booting': return 0.3
      case 'ready': return 0.05
      case 'listening': return 0.15
      case 'speaking': return 0.8
      case 'thinking': return 0.2
      case 'error': return 0.02
      default: return 0.05
    }
  }, [state])

  // Get color based on state
  const getColors = useCallback(() => {
    switch (state) {
      case 'booting': return { h: 45, s: 100, l: 50 }  // gold
      case 'ready': return { h: 185, s: 100, l: 50 }   // cyan
      case 'listening': return { h: 185, s: 100, l: 50 } // cyan
      case 'speaking': return { h: 185, s: 100, l: 50 } // cyan→gold
      case 'thinking': return { h: 45, s: 100, l: 50 }  // gold
      case 'error': return { h: 0, s: 100, l: 50 }      // red
      default: return { h: 185, s: 100, l: 50 }
    }
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2
    const baseRadius = size * 0.25  // inner circle (arc reactor)
    const maxRadius = size * 0.48  // outer edge
    const maxBarLength = maxRadius - baseRadius - 4

    // Smoothing
    const smoothedData = new Float32Array(barCount).fill(0)

    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      // Read audio data if available
      let audioData: Uint8Array | null = null
      if (analyser && state === 'speaking') {
        analyser.getByteFrequencyData(dataRef.current)
        audioData = dataRef.current
      }

      const targetAmp = getTargetAmplitude()
      const colors = getColors()
      const time = Date.now() / 1000

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2

        // Get value from audio or generate synthetic animation
        let value: number
        if (audioData) {
          // Map frequency bin to this bar
          const binIndex = Math.floor((i / barCount) * audioData.length * 0.5)
          value = audioData[binIndex] / 255
        } else {
          // Synthetic animation based on state
          const phase = (i / barCount) * Math.PI * 2
          switch (state) {
            case 'ready':
              // Gentle breathing
              value = 0.05 + Math.sin(time * 2 + phase) * 0.03
              break
            case 'listening':
              // Subtle wave
              value = 0.1 + Math.sin(time * 3 + phase * 2) * 0.08
              break
            case 'thinking':
              // Spinning wave
              value = 0.15 + Math.sin(time * 4 + phase * 3) * 0.1
              break
            case 'booting':
              // Pulsing
              value = 0.2 + Math.sin(time * 2) * 0.15
              break
            case 'error':
              // Faint pulse
              value = 0.02 + Math.sin(time) * 0.02
              break
            case 'speaking':
              // Random peaks (simulated until real audio)
              value = 0.3 + Math.sin(time * 8 + phase) * 0.2 + Math.random() * 0.1
              break
            default:
              value = 0.05
          }
        }

        // Smooth interpolation
        smoothedData[i] += (value - smoothedData[i]) * 0.15
        const smoothed = smoothedData[i]

        const barLength = Math.max(2, smoothed * maxBarLength * targetAmp + 2)

        // Bar start/end points
        const x1 = centerX + Math.cos(angle) * baseRadius
        const y1 = centerY + Math.sin(angle) * baseRadius
        const x2 = centerX + Math.cos(angle) * (baseRadius + barLength)
        const y2 = centerY + Math.sin(angle) * (baseRadius + barLength)

        // Color shifts with intensity
        const h = colors.h + smoothed * 30  // shift hue with intensity
        const l = colors.l + smoothed * 20

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = `hsl(${h}, ${colors.s}%, ${l}%)`
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.globalAlpha = 0.6 + smoothed * 0.4
        ctx.stroke()
      }

      // Inner reactor glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius)
      gradient.addColorStop(0, `hsla(${colors.h}, ${colors.s}%, 70%, ${0.3 + Math.sin(time * 2) * 0.15})`)
      gradient.addColorStop(0.7, `hsla(${colors.h}, ${colors.s}%, 50%, 0.1)`)
      gradient.addColorStop(1, `hsla(${colors.h}, ${colors.s}%, 50%, 0)`)

      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius - 4, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Inner core
      ctx.beginPath()
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${colors.h}, ${colors.s}%, 80%, ${0.8 + Math.sin(time * 3) * 0.2})`
      ctx.fill()

      ctx.globalAlpha = 1
      animFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [state, size, analyser, barCount, getTargetAmplitude, getColors])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        display: 'block'
      }}
    />
  )
}
