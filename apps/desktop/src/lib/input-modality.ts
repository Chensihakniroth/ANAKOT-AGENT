// Input modality tracking — detect and track the current input mode.

export type InputModality = 'keyboard' | 'voice' | 'pen' | 'touch'

let currentModality: InputModality = 'keyboard'
const listeners = new Set<(modality: InputModality) => void>()

/** Report the current input modality (called on input events). */
export function reportInputModality(modality: InputModality): void {
  if (modality === currentModality) return
  currentModality = modality
  listeners.forEach(fn => fn(modality))
}

/** Get the current input modality. */
export function getInputModality(): InputModality {
  return currentModality
}

/** Subscribe to modality changes. */
export function onInputModalityChange(callback: (modality: InputModality) => void): () => void {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

/** Map a DOM event to an input modality. */
export function detectModalityFromEvent(event: InputEvent | PointerEvent | KeyboardEvent): InputModality {
  if (event instanceof PointerEvent) {
    if (event.pointerType === 'pen') return 'pen'
    if (event.pointerType === 'touch') return 'touch'
    return 'keyboard' // mouse falls back to keyboard mode
  }
  if (event instanceof KeyboardEvent) return 'keyboard'
  if (event instanceof InputEvent) {
    if (event.inputType === 'insertFromPaste') return 'keyboard'
  }
  return 'keyboard'
}
