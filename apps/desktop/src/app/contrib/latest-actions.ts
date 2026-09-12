// Contrib latest actions — tracks the most recent user actions.

import { atom } from 'nanostores'

import type { ContribLatestAction } from './types'

export const $latestActions = atom<ContribLatestAction[]>([])

export function pushLatestAction(action: ContribLatestAction): void {
  $latestActions.set([action, ...$latestActions.get().slice(0, 19)])
}

export function clearLatestActions(): void {
  $latestActions.set([])
}
