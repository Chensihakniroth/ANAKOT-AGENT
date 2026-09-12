// Contrib hooks — React hooks for the contribution system.

import { useStore } from '@nanostores/react'

import { $latestActions } from '../latest-actions'

export function useLatestActions() {
  return useStore($latestActions)
}
