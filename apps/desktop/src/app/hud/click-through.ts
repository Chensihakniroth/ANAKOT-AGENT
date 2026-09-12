// HUD click-through regions — defines which areas of the HUD are click-through
// vs interactive. Used for transparent overlay modes.

export interface ClickThroughRegion {
  x: number
  y: number
  width: number
  height: number
  clickThrough: boolean
}

/**
 * Determine if a point in the HUD should pass clicks through to the window
 * beneath it. Useful for transparent/translucent overlay modes.
 */
export function isClickThrough(regions: ClickThroughRegion[], x: number, y: number): boolean {
  for (const region of regions) {
    if (
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height
    ) {
      return region.clickThrough
    }
  }
  return false
}
