// HUD layout constants + zones

export const HUD_DEFAULT_WIDTH = 480
export const HUD_MIN_WIDTH = 280
export const HUD_MAX_WIDTH = 720
export const HUD_DEFAULT_HEIGHT = 'auto'

export interface HudZone {
  id: string
  label: string
  visible: boolean
}

export const DEFAULT_HUD_ZONES: HudZone[] = [
  { id: 'transcript', label: 'Transcript', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'actions', label: 'Actions', visible: false },
]
