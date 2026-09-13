// Floating HUD — ported from Hermes
export interface FloatingHudState { visible: boolean; sessionId: string | null }
export function getFloatingHudState(): FloatingHudState { return { visible: false, sessionId: null } }