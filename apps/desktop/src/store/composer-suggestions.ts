import { atom } from 'nanostores'

// Composer suggestions — ported from Hermes
// Provides suggestion pills for the composer

export interface ComposerSuggestion {
  id: string
  prompt: string
  label: string
  icon?: string
}

export const $composerSuggestions = atom<ComposerSuggestion[]>([])

export function setComposerSuggestions(suggestions: ComposerSuggestion[]): void {
  $composerSuggestions.set(suggestions)
}

export function clearComposerSuggestions(): void {
  $composerSuggestions.set([])
}
