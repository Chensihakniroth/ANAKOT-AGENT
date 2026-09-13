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
  connected: boolean
  draft: string
  sessions: Array<{ id: string; title: string }>
  submitting: boolean
  target: string
  visible: boolean
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
  connected: false,
  draft: '',
  sessions: [],
  submitting: false,
  target: QUICK_TARGET_CURRENT,
  visible: true,
}

export function quickComposerReducer(
  current: QuickComposerState,
  event: QuickComposerEvent
): { send: QuickEntrySubmitPayload | null; state: QuickComposerState } {
  switch (event.type) {
    case 'SET_QUERY':
      return { send: null, state: { ...current, draft: event.query } }
    case 'SET_TARGET':
      return { send: null, state: { ...current, target: event.target } }
    case 'shown':
      // Re-summoned: reset draft and target, keep gateway truth
      return {
        send: null,
        state: {
          ...current,
          visible: true,
          draft: '',
          target: QUICK_TARGET_CURRENT,
          submitting: false,
        },
      }
    case 'state': {
      // Update sessions and connection; validate target still exists
      const sessions = event.sessions
      const targetValid =
        current.target === QUICK_TARGET_CURRENT ||
        current.target === QUICK_TARGET_NEW ||
        sessions.some(s => s.id === current.target)
      return {
        send: null,
        state: {
          ...current,
          connected: event.connected,
          sessions,
          target: targetValid ? current.target : QUICK_TARGET_CURRENT,
        },
      }
    }
    case 'blur':
      return { send: null, state: { ...current, visible: false, draft: '', submitting: false } }
    case 'edit':
      return { send: null, state: { ...current, draft: event.draft } }
    case 'submit':
      if (!current.draft.trim() || !current.connected || current.submitting) {
        return { send: null, state: current }
      }
      return {
        send: { text: current.draft.trim(), target: current.target },
        state: { ...current, submitting: true, draft: '', visible: false },
      }
    case 'dismiss':
      return {
        send: null,
        state: { ...current, visible: false, draft: '', target: QUICK_TARGET_CURRENT },
      }
    case 'target':
      return { send: null, state: { ...current, target: event.value } }
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
