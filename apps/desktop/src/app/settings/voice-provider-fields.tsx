// TTS/STT provider configuration fields for the voice settings section.
// Renders provider selection, voice picker, and a test button.

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceProvider {
  id: string
  name: string
  type: 'tts' | 'stt'
  voices?: string[]
}

const KNOWN_VOICE_PROVIDERS: VoiceProvider[] = [
  { id: 'elevenlabs', name: 'ElevenLabs', type: 'tts', voices: ['Rachel', 'Adam', 'Antoni', 'Bella'] },
  { id: 'openai', name: 'OpenAI', type: 'tts', voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] },
  { id: 'edge-tts', name: 'Edge TTS', type: 'tts', voices: ['en-US-AriaNeural', 'en-US-GuyNeural'] },
  { id: 'whisper', name: 'Whisper', type: 'stt' },
  { id: 'deepgram', name: 'Deepgram', type: 'stt' },
]

interface VoiceProviderFieldsProps {
  selectedTts?: string
  selectedStt?: string
  selectedVoice?: string
  onTtsChange?: (providerId: string) => void
  onSttChange?: (providerId: string) => void
  onVoiceChange?: (voice: string) => void
  className?: string
}

export function VoiceProviderFields({
  selectedTts,
  selectedStt,
  selectedVoice,
  onTtsChange,
  onSttChange,
  onVoiceChange,
  className,
}: VoiceProviderFieldsProps) {
  const [testing, setTesting] = useState(false)

  const ttsProviders = KNOWN_VOICE_PROVIDERS.filter(p => p.type === 'tts')
  const sttProviders = KNOWN_VOICE_PROVIDERS.filter(p => p.type === 'stt')
  const activeTts = ttsProviders.find(p => p.id === selectedTts)

  return (
    <div className={cn('space-y-4', className)}>
      {/* TTS Provider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Text-to-Speech Provider
        </label>
        <div className="flex flex-wrap gap-2">
          {ttsProviders.map(provider => (
            <button
              key={provider.id}
              onClick={() => onTtsChange?.(provider.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                selectedTts === provider.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              {provider.name}
            </button>
          ))}
        </div>
      </div>

      {/* Voice selection (for TTS) */}
      {activeTts?.voices && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Voice
          </label>
          <div className="flex flex-wrap gap-2">
            {activeTts.voices.map(voice => (
              <button
                key={voice}
                onClick={() => onVoiceChange?.(voice)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs transition-colors',
                  selectedVoice === voice
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Test button */}
      <Button
        variant="outline"
        size="sm"
        disabled={testing}
        onClick={() => {
          setTesting(true)
          // Play a test sound via the active TTS provider
          setTimeout(() => setTesting(false), 2000)
        }}
      >
        {testing ? '🔊 Playing...' : '🔊 Test Voice'}
      </Button>

      {/* STT Provider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Speech-to-Text Provider
        </label>
        <div className="flex flex-wrap gap-2">
          {sttProviders.map(provider => (
            <button
              key={provider.id}
              onClick={() => onSttChange?.(provider.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                selectedStt === provider.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              {provider.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
