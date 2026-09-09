import { atom } from 'nanostores'

type SearchStore = {
  query: string
  activeSection?: string
  matchedKeys: string[]
  matchedSections: string[]
}

export const searchStore = atom<SearchStore>({ 
  query: '',
  matchedKeys: [],
  matchedSections: []
})

export const setSearchQuery = (query: string, allKeys: string[] = [], allSections: string[] = []) => {
  const { activeSection } = searchStore.get()
  const { matchedKeys, matchedSections } = searchForKeys(query, allKeys, allSections)
  searchStore.set({ query, activeSection, matchedKeys, matchedSections })
}

export const setActiveSection = (section?: string) => {
  const current = searchStore.get()
  searchStore.set({ ...current, activeSection: section })
}

export function searchForKeys(query: string, allKeys: string[] = [], allSections: string[] = []): { matchedKeys: string[], matchedSections: string[] } {
  if (!query) return { matchedKeys: [], matchedSections: [] }
  const lowerQuery = query.toLowerCase()
  
  const matchedKeys = allKeys.filter(key => key.toLowerCase().includes(lowerQuery))
  const matchedSections = allSections.filter(section => section.toLowerCase().includes(lowerQuery))
  
  return { matchedKeys, matchedSections }
}