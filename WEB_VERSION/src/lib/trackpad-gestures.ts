// Trackpad gesture helpers for star-map canvas interactions.

export interface DoubleTapDetector {
  (): boolean
}

export function createDoubleTapDetector(): DoubleTapDetector {
  let lastTap = 0

  return () => {
    const now = Date.now()
    const isDouble = now - lastTap < 300

    lastTap = now

    return isDouble
  }
}

// Detect smart zoom (pinch-to-zoom) wheels — most browsers set ctrlKey for
// precision trackpad zoom. When false, the scroll is a regular scrollwheel.
export function isSmartZoomWheel(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}
