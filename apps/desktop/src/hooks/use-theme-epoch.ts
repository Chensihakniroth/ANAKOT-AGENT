import { useState } from 'react'

// Incrementing epoch counter used as an effect dependency: when the theme
// changes the palette is recomputed and the canvas redraws.
let _epoch = 0

export function useThemeEpoch(): number {
  const [epoch] = useState(() => ++_epoch)

  return epoch
}
