// Schema-driven settings search — builds an index of all config fields,
// credentials, and plugins, then scores/filters by query.

export interface SearchEntry {
  key: string
  label: string
  description?: string
  category: 'config' | 'credential' | 'plugin'
  path: string[]
}

export interface SettingsSearchIndex {
  entries: SearchEntry[]
}

/** Tokenize a query for fuzzy matching. */
function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** Score an entry against query tokens. Higher = better match. */
function scoreEntry(entry: SearchEntry, tokens: string[]): number {
  const searchable = `${entry.key} ${entry.label} ${entry.description ?? ''} ${entry.path.join(' ')}`.toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (entry.key.toLowerCase() === token) score += 10 // exact key match
    if (entry.label.toLowerCase() === token) score += 8 // exact label match
    if (searchable.includes(token)) score += 3 // substring match
  }

  // All tokens must match for a result
  const allMatch = tokens.every(t => searchable.includes(t))
  return allMatch ? score : 0
}

/**
 * Build a search index from the known settings structure.
 * In a real implementation this would read from the config schema API.
 */
export function buildSettingsSearchIndex(): SettingsSearchIndex {
  const entries: SearchEntry[] = []

  // Config fields (static index — could be extended with schema API)
  const configSections = [
    { id: 'model', label: 'Model', fields: ['model', 'provider', 'temperature', 'max_tokens'] },
    { id: 'chat', label: 'Chat', fields: ['streaming', 'auto_scroll', 'show_timestamps'] },
    { id: 'appearance', label: 'Appearance', fields: ['theme', 'font_size', 'window_opacity'] },
    { id: 'terminal', label: 'Terminal', fields: ['shell', 'font_family', 'font_size'] },
    { id: 'voice', label: 'Voice', fields: ['tts_provider', 'stt_provider', 'voice'] },
    { id: 'memory', label: 'Memory & Context', fields: ['memory_provider', 'context_window'] },
  ]

  for (const section of configSections) {
    for (const field of section.fields) {
      entries.push({
        key: `${section.id}.${field}`,
        label: field.replace(/_/g, ' '),
        description: `${section.label} setting`,
        category: 'config',
        path: [section.id],
      })
    }
  }

  return { entries }
}

/** Filter and rank entries by query. Returns sorted matches. */
export function searchSettingsIndex(index: SettingsSearchIndex, query: string): SearchEntry[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  return index.entries
    .map(entry => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry)
}
