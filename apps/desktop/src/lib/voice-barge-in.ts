// Voice barge-in detection — detect when the user starts speaking while
// TTS is playing, so we can stop the response.

let ttsPlaying = false
let bargeInCallback: (() => void) | null = null

export function setTtsPlaying(playing: boolean): void {
  ttsPlaying = playing
}

export function isTtsPlaying(): boolean {
  return ttsPlaying
}

/** Register a callback fired when barge-in is detected. */
export function onBargeIn(callback: () => void): () => void {
  bargeInCallback = callback
  return () => {
    if (bargeInCallback === callback) bargeInCallback = null
  }
}

/** Report detected speech input — triggers barge-in if TTS is playing. */
export function reportSpeechInput(): void {
  if (ttsPlaying && bargeInCallback) {
    bargeInCallback()
  }
}
