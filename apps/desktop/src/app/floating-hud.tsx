
import { useStore } from '@nanostores/react'

import { $floatingHudVisible, toggleFloatingHud } from '@/store/floating-hud'

export function FloatingHud() {
  const visible = useStore($floatingHudVisible)

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Quick Actions</h3>
        <button
          onClick={toggleFloatingHud}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <button className="rounded px-3 py-1 text-left text-sm hover:bg-muted">
          New Session
        </button>
        <button className="rounded px-3 py-1 text-left text-sm hover:bg-muted">
          Open Settings
        </button>
        <button className="rounded px-3 py-1 text-left text-sm hover:bg-muted">
          View Timeline
        </button>
      </div>
    </div>
  )
}
