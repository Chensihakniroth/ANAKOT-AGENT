import { atom } from 'nanostores'
// Suggestion providers — ported from Hermes
export interface SuggestionProvider { id: string; name: string; enabled: boolean }
export const $suggestionProviders = atom<SuggestionProvider[]>([])