import { atom } from 'nanostores'

export interface FindInPageState {
  active: boolean
  query: string
  matchOrdinal: number
  matchCount: number
}

const EMPTY: FindInPageState = { active: false, query: '', matchOrdinal: 0, matchCount: 0 }

export const $findInPage = atom<FindInPageState>({ ...EMPTY })

export function openFindBar(): void {
  $findInPage.set({ ...EMPTY, active: true })
}

export function closeFindBar(): void {
  if (!$findInPage.get().active) return
  $findInPage.set({ ...EMPTY })
  void window.anakotDesktop?.stopFindInPage?.()
}

export function setFindQuery(query: string): void {
  const current = $findInPage.get()
  if (!current.active) return

  $findInPage.set({ ...current, query, matchOrdinal: 0, matchCount: 0 })
  if (query) {
    void window.anakotDesktop?.findInPage?.(query, { forward: true, findNext: false })
  } else {
    void window.anakotDesktop?.stopFindInPage?.()
  }
}

export function findNext(): void {
  const { query } = $findInPage.get()
  if (query) void window.anakotDesktop?.findInPage?.(query, { forward: true, findNext: true })
}

export function findPrevious(): void {
  const { query } = $findInPage.get()
  if (query) void window.anakotDesktop?.findInPage?.(query, { forward: false, findNext: true })
}

export function updateFindResults(activeMatch: number, count: number): void {
  $findInPage.set({ ...$findInPage.get(), matchOrdinal: activeMatch, matchCount: count })
}

export function formatFindMatchLabel(query: string, ordinal: number, count: number): string {
  if (!query) return ''
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (!safeCount) return '0/0'
  return `${Math.min(Math.max(Math.floor(ordinal), 0), safeCount)}/${safeCount}`
}
