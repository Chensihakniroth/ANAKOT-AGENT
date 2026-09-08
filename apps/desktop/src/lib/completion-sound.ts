import { $completionSoundEnabled } from '@/store/completion-sound'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  try {
    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) return null
    audioContext ??= new AudioContextCtor()
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined)
    return audioContext
  } catch {
    return null
  }
}

export function playCompletionSound(): void {
  if (!$completionSoundEnabled.get()) return

  const context = getAudioContext()
  if (!context) return

  const now = context.currentTime
  const master = context.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  master.connect(context.destination)

  for (const [offset, frequency] of [[0, 523.25], [0.12, 659.25]] as const) {
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, now + offset)
    oscillator.connect(master)
    oscillator.start(now + offset)
    oscillator.stop(now + offset + 0.25)
  }
}
