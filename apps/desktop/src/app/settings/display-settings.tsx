import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { getAnakotConfigRecord, saveAnakotConfig } from '@/anakot'
import { $displayTimestamps, setDisplayTimestamps } from '@/store/display-timestamps'
import { $userBubbleTransparency, setUserBubbleTransparency } from '@/store/user-bubble-transparency'

export function DisplaySettings() {
  const { t } = useI18n()
  const displayTimestamps = useStore($displayTimestamps)
  const bubbleTransparency = useStore($userBubbleTransparency)

  return (
    <div className="flex flex-col gap-6 p-4">
      <h2 className="text-lg font-semibold">Display Settings</h2>

      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between">
          <span className="text-sm">Show message timestamps</span>
          <input
            type="checkbox"
            checked={displayTimestamps}
            onChange={(e) => setDisplayTimestamps(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm">Message bubble transparency</span>
          <input
            type="range"
            min="0"
            max="100"
            value={bubbleTransparency}
            onChange={(e) => setUserBubbleTransparency(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-muted-foreground">{bubbleTransparency}%</span>
        </label>
      </div>
    </div>
  )
}
