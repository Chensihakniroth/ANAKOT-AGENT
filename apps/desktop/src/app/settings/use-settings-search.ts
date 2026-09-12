// Hook for consuming the settings search index with live query filtering.

import { useMemo, useState } from 'react'

import { buildSettingsSearchIndex, searchSettingsIndex, type SearchEntry } from './settings-search'

export function useSettingsSearch() {
  const [query, setQuery] = useState('')
  const index = useMemo(() => buildSettingsSearchIndex(), [])

  const results = useMemo(() => searchSettingsIndex(index, query), [index, query])

  return {
    query,
    setQuery,
    results,
    hasQuery: query.trim().length > 0,
    clearQuery: () => setQuery(''),
  }
}
