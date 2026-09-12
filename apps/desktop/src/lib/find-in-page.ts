// Find-in-page logic — core search functionality shared between the
// shell find bar and chat find bar.

export interface FindInPageState {
  query: string
  activeMatch: number
  matchCount: number
}

export interface FindInPageMatch {
  index: number
  text: string
  startIndex: number
  endIndex: number
}

/** Find all occurrences of a query in text (case-insensitive). */
export function findMatches(text: string, query: string): FindInPageMatch[] {
  if (!query.trim()) return []

  const matches: FindInPageMatch[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let startIndex = 0

  while (true) {
    const idx = lowerText.indexOf(lowerQuery, startIndex)
    if (idx === -1) break
    matches.push({
      index: matches.length,
      text: text.slice(idx, idx + query.length),
      startIndex: idx,
      endIndex: idx + query.length,
    })
    startIndex = idx + 1
  }

  return matches
}

/** Clamp an active match index to valid range. */
export function clampActiveMatch(active: number, matchCount: number): number {
  if (matchCount === 0) return 0
  if (active < 0) return matchCount - 1
  if (active >= matchCount) return 0
  return active
}

/** Create initial find state. */
export function createFindState(): FindInPageState {
  return { query: '', activeMatch: 0, matchCount: 0 }
}
