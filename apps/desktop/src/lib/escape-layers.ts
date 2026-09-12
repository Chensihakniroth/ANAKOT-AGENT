// Escape layer stack — manages modal/popover priority for nested overlays.
// Higher layers capture Escape; the topmost layer handles it first.

type EscapeHandler = () => boolean // return true if handled

const layers: Array<{ id: string; handler: EscapeHandler }> = []

export function pushEscapeLayer(id: string, handler: EscapeHandler): () => void {
  // Remove existing layer with same id (re-entrance guard)
  const existing = layers.findIndex(l => l.id === id)
  if (existing !== -1) layers.splice(existing, 1)

  layers.push({ id, handler })
  return () => {
    const idx = layers.findIndex(l => l.id === id)
    if (idx !== -1) layers.splice(idx, 1)
  }
}

/** Process an escape press — called from the top-level keydown handler. */
export function handleEscapePress(): boolean {
  // Iterate from top (last) to bottom (first)
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].handler()) return true
  }
  return false
}

export function getEscapeLayerCount(): number {
  return layers.length
}
