import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { $autoSpeakReplies, setAutoSpeakReplies } from '@/store/voice-prefs'

export function VoicePrefsSettings() {
  const { t } = useI18n()
  const autoSpeak = useStore($autoSpeakReplies)

  return (
    <div className="flex flex-col gap-6 p-4">
      <h2 className="text-lg font-semibold">Voice Preferences</h2>

      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between">
          <span className="text-sm">Auto-speak responses</span>
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(e) => setAutoSpeakReplies(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </label>

        <p className="text-xs text-muted-foreground">
          Automatically read agent responses aloud when a voice conversation is active.
        </p>
      </div>
    </div>
  )
}
