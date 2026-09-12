// Composer suggestion engine — inline suggestions that appear below the composer.
// Contributions register suggestion providers; this store holds the results.

import { atom } from 'nanostores'

export interface ComposerSuggestion {
  id: string
  label: string
  prompt: string
  icon?: string
}

export const $composerSuggestions = atom<ComposerSuggestion[]>([])

export function setComposerSuggestions(suggestions: ComposerSuggestion[]): void {
  $composerSuggestions.set(suggestions)
}

export function appendComposerSuggestion(suggestion: ComposerSuggestion): void {
  const current = $composerSuggestions.get()
  // Avoid duplicates
  if (current.some(s => s.id === suggestion.id)) return
  $composerSuggestions.set([...current, suggestion])
}

export function clearComposerSuggestions(): void {
  $composerSuggestions.set([])
}
