import { atom } from 'nanostores'
// Quick entry — ported from Hermes
export interface QuickEntryAction { id: string; label: string; run: () => void }

export const $quickEntryActions = atom<QuickEntryAction[]>([
  { id: 'new-session', label: 'New Session', run: () => {} },
  { id: 'open-settings', label: 'Open Settings', run: () => {} },
  { id: 'toggle-timeline', label: 'Toggle Timeline', run: () => {} },
  { id: 'search-sessions', label: 'Search Sessions', run: () => {} },
])

export function registerQuickEntryAction(action: QuickEntryAction) {
  $quickEntryActions.set([...$quickEntryActions.get(), action])
}

export function getQuickEntryActions(): QuickEntryAction[] {
  return $quickEntryActions.get()
}

// Quick composer state for quick-entry-app.tsx
export interface QuickComposerState {
  query: string
  draft: string
  target: string
  visible: boolean
  connected: boolean
  submitting?: boolean
  sessions: Array<{ id: string; title: string }>
}

export interface QuickEntrySubmitPayload { text: string; target: string }

export type QuickComposerEvent =
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_TARGET'; target: string }
  | { type: 'shown' }
  | { type: 'state'; connected: boolean; sessions: Array<{ id: string; title: string }> }
  | { type: 'blur' }
  | { type: 'edit'; draft: string }
  | { type: 'submit' }
  | { type: 'dismiss' }
  | { type: 'target'; value: string }

export const QUICK_TARGET_CURRENT = 'current'
export const QUICK_TARGET_NEW = 'new'

export const initialQuickComposerState: QuickComposerState = {
  query: '',
  draft: '',
  target: QUICK_TARGET_CURRENT,
  visible: true,
  connected: true,
  sessions: [],
}

export function quickComposerReducer(
  current: QuickComposerState,
  event: QuickComposerEvent
): { send: { text: string; target: string } | null; state: QuickComposerState } {
  switch (event.type) {
    case 'SET_QUERY':
      return { send: null, state: { ...current, query: event.query } }
    case 'SET_TARGET':
      return { send: null, state: { ...current, target: event.target } }
    case 'shown':
      return { send: null, state: { ...current, visible: true, query: '', draft: '' } }
    case 'state':
      return { send: null, state: { ...current, connected: event.connected, sessions: event.sessions } }
    case 'blur':
      return { send: null, state: { ...current, visible: false } }
    case 'edit':
      return { send: null, state: { ...current, draft: event.draft } }
    case 'submit':
      if (!current.draft.trim()) {
        return { send: null, state: current }
      }
      return {
        send: { text: current.draft.trim(), target: current.target },
        state: { ...current, visible: false },
      }
    case 'dismiss':
      return { send: null, state: { ...current, visible: false } }
    case 'target':
      return { send: null, state: { ...current, target: event.value === QUICK_TARGET_CURRENT ? QUICK_TARGET_NEW : QUICK_TARGET_CURRENT } }
    default:
      return { send: null, state: current }
  }
}

// Quick entry bridge
export interface QuickEntrySessionOption { id: string; title: string }

export function initQuickEntryBridge(): () => void {
  return () => {}
}

export function setQuickEntrySubmitHandler(_handler: ((payload: { target: string; text: string }) => void) | null) {
  // Stub: set submit handler
}

export const $quickEntry = atom<{ enabled: boolean; shortcut?: string; registered?: boolean; error?: string }>({ enabled: true })
export const QUICK_ENTRY_DEFAULT_SHORTCUT = 'CmdOrCtrl+Shift+K'

export function canUseQuickEntry(): boolean {
  return $quickEntry.get().enabled
}

export function loadQuickEntrySettings(): { enabled: boolean; shortcut?: string; registered?: boolean; error?: string } {
  return $quickEntry.get()
}

export function saveQuickEntrySettings(settings: { enabled?: boolean; shortcut?: string }) {
  $quickEntry.set({ ...$quickEntry.get(), ...settings })
}

export { QuickEntry } from '@/app/quick-entry/QuickEntryView'
