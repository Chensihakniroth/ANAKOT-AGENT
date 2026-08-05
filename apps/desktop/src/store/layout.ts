import { atom, computed, type ReadableAtom } from 'nanostores'

import {
  arraysEqual,
  insertUniqueId,
  persistBoolean,
  persistStringArray,
  persistStringRecord,
  storedBoolean,
  storedStringArray,
  storedStringRecord
} from '@/lib/storage'

import { $paneStates, ensurePaneRegistered, setPaneOpen, setPaneWidthOverride, togglePane } from './panes'

export const SIDEBAR_DEFAULT_WIDTH = 237
export const SIDEBAR_MAX_WIDTH = 360
// Open at the same width as the sessions sidebar so the two rails match.
export const FILE_BROWSER_DEFAULT_WIDTH = `${SIDEBAR_DEFAULT_WIDTH}px`
export const FILE_BROWSER_MIN_WIDTH = '14rem'
export const FILE_BROWSER_MAX_WIDTH = '20rem'

export const SIDEBAR_SESSIONS_PAGE_SIZE = 50

export const SIDEBAR_PINNED_STORAGE_KEY = 'anakot.desktop.pinnedSessions'
const SIDEBAR_AGENTS_GROUPED_STORAGE_KEY = 'anakot.desktop.agentsGroupedByWorkspace'
const PANES_FLIPPED_STORAGE_KEY = 'anakot.desktop.panesFlipped'
// Resolved open/collapse per sidebar workspace node (repo/worktree lanes).
// An ABSOLUTE value per node id: a lane whose default flips — a worktree lane
// defaults collapsed while empty, open once it holds a session — keeps whatever
// the user explicitly chose instead of silently reinterpreting it.
const SIDEBAR_WORKSPACE_NODE_OPEN_STORAGE_KEY = 'anakot.desktop.workspaceNodeOpen'
// Manual drag-order for the project overview rows (project ids) and, within an
// entered project, the repo subtrees (repo ids) and their worktree/branch lanes
// (lane ids). Same persistence pattern as workspaceNodeOpen.
const SIDEBAR_PROJECT_ORDER_STORAGE_KEY = 'anakot.desktop.projectOrder'
const SIDEBAR_REPO_ORDER_STORAGE_KEY = 'anakot.desktop.repoOrder'

export const CHAT_SIDEBAR_PANE_ID = 'chat-sidebar'
export const FILE_BROWSER_PANE_ID = 'file-browser'
export const RIGHT_RAIL_PREVIEW_TAB_ID = 'preview'

/** Toggle the chat timeline rail open/closed. */
export const $timelineOpen = atom(true)

export const RIGHT_RAIL_CODE_REVIEW_TAB_ID = 'code-review'
export const RIGHT_RAIL_GIT_COMMIT_TAB_ID = 'git-commit'

export type RightRailTabId = typeof RIGHT_RAIL_PREVIEW_TAB_ID | typeof RIGHT_RAIL_CODE_REVIEW_TAB_ID | typeof RIGHT_RAIL_GIT_COMMIT_TAB_ID | `file:${string}`

ensurePaneRegistered(CHAT_SIDEBAR_PANE_ID, { open: true })
ensurePaneRegistered(FILE_BROWSER_PANE_ID, { open: false })

export const $sidebarOpen: ReadableAtom<boolean> = computed(
  $paneStates,
  states => states[CHAT_SIDEBAR_PANE_ID]?.open ?? true
)

export const $fileBrowserOpen: ReadableAtom<boolean> = computed(
  $paneStates,
  states => states[FILE_BROWSER_PANE_ID]?.open ?? false
)

export const $rightRailActiveTabId = atom<RightRailTabId>(RIGHT_RAIL_PREVIEW_TAB_ID)

export const $sidebarWidth: ReadableAtom<number> = computed($paneStates, states => {
  const override = states[CHAT_SIDEBAR_PANE_ID]?.widthOverride

  return typeof override === 'number' ? override : SIDEBAR_DEFAULT_WIDTH
})

export const $pinnedSessionIds = atom(storedStringArray(SIDEBAR_PINNED_STORAGE_KEY))
export const $sidebarPinsOpen = atom(true)
export const $sidebarRecentsOpen = atom(true)
export const $sidebarAgentsGrouped = atom(storedBoolean(SIDEBAR_AGENTS_GROUPED_STORAGE_KEY, false))
// When true, the sessions sidebar moves to the right and the file browser +
// preview rail move to the left — a mirror of the default layout.
export const $panesFlipped = atom(storedBoolean(PANES_FLIPPED_STORAGE_KEY, false))
export const $isSidebarResizing = atom(false)
export const $sessionsLimit = atom(SIDEBAR_SESSIONS_PAGE_SIZE)
// Resolved open/collapse per sidebar workspace node (repo/worktree lanes).
// Absolute booleans keyed by node id — see SIDEBAR_WORKSPACE_NODE_OPEN_STORAGE_KEY.
export const $sidebarWorkspaceNodeOpen = atom<Record<string, boolean>>(
  storedStringRecord(SIDEBAR_WORKSPACE_NODE_OPEN_STORAGE_KEY) as unknown as Record<string, boolean>
)

$pinnedSessionIds.subscribe(ids => persistStringArray(SIDEBAR_PINNED_STORAGE_KEY, [...ids]))
$sidebarWorkspaceNodeOpen.subscribe(state =>
  persistStringRecord(
    SIDEBAR_WORKSPACE_NODE_OPEN_STORAGE_KEY,
    state as unknown as Record<string, string>
  )
)
$sidebarAgentsGrouped.subscribe(grouped => persistBoolean(SIDEBAR_AGENTS_GROUPED_STORAGE_KEY, grouped))
$panesFlipped.subscribe(flipped => persistBoolean(PANES_FLIPPED_STORAGE_KEY, flipped))

export function setSidebarWidth(width: number) {
  const bounded = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_DEFAULT_WIDTH, width))
  setPaneWidthOverride(CHAT_SIDEBAR_PANE_ID, bounded)
}

export function setSidebarOpen(open: boolean) {
  setPaneOpen(CHAT_SIDEBAR_PANE_ID, open)
}

export function toggleSidebarOpen() {
  togglePane(CHAT_SIDEBAR_PANE_ID)
}

export function toggleFileBrowserOpen() {
  togglePane(FILE_BROWSER_PANE_ID)
}

export function setFileBrowserOpen(open: boolean) {
  setPaneOpen(FILE_BROWSER_PANE_ID, open)
}

// ── Right rail collapse (file-browser + preview as a unit) ──────────────────
// $rightRailCollapsed is a "master hide" that forces both right-side panes to
// zero width without destroying their individual state.  Toggling it back
// restores each pane to whatever it was doing before (file-browser open/closed,
// preview showing/hidden based on target).

const RIGHT_RAIL_COLLAPSED_KEY = 'anakot.desktop.rightRailCollapsed'

export const $rightRailCollapsed = atom(storedBoolean(RIGHT_RAIL_COLLAPSED_KEY, false))

$rightRailCollapsed.subscribe(collapsed => persistBoolean(RIGHT_RAIL_COLLAPSED_KEY, collapsed))

export function toggleRightRail() {
  $rightRailCollapsed.set(!$rightRailCollapsed.get())
}

// Hotkey → focus the sessions search field. Opens the sidebar first, then lets
// the field (which only mounts when the sidebar is open) subscribe + focus.
export const SESSION_SEARCH_FOCUS_EVENT = 'anakot:focus-session-search'

export function requestSessionSearchFocus() {
  setSidebarOpen(true)

  if (typeof window !== 'undefined') {
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(SESSION_SEARCH_FOCUS_EVENT)), 0)
  }
}

export function togglePanesFlipped() {
  $panesFlipped.set(!$panesFlipped.get())
}

export function selectRightRailTab(id: RightRailTabId) {
  $rightRailActiveTabId.set(id)
}

export function setSidebarPinsOpen(open: boolean) {
  $sidebarPinsOpen.set(open)
}

export function setSidebarRecentsOpen(open: boolean) {
  $sidebarRecentsOpen.set(open)
}

export function setSidebarAgentsGrouped(grouped: boolean) {
  $sidebarAgentsGrouped.set(grouped)
}

export function setSidebarResizing(resizing: boolean) {
  $isSidebarResizing.set(resizing)
}

export function pinSession(sessionId: string, index?: number) {
  const prev = $pinnedSessionIds.get()
  const next = insertUniqueId(prev, sessionId, index ?? prev.filter(id => id !== sessionId).length)

  if (!arraysEqual(prev, next)) {
    $pinnedSessionIds.set(next)
  }
}

export function unpinSession(sessionId: string) {
  const prev = $pinnedSessionIds.get()
  const next = prev.filter(id => id !== sessionId)

  if (!arraysEqual(prev, next)) {
    $pinnedSessionIds.set(next)
  }
}

export function reorderPinnedSession(sessionId: string, targetIndex: number) {
  const prev = $pinnedSessionIds.get()

  if (!prev.includes(sessionId)) {
    return
  }

  const next = insertUniqueId(prev, sessionId, targetIndex)

  if (!arraysEqual(prev, next)) {
    $pinnedSessionIds.set(next)
  }
}

export function bumpSessionsLimit(step: number = SIDEBAR_SESSIONS_PAGE_SIZE) {
  const safeStep = Math.max(1, Math.floor(step))
  $sessionsLimit.set($sessionsLimit.get() + safeStep)
}

export function resetSessionsLimit() {
  if ($sessionsLimit.get() !== SIDEBAR_SESSIONS_PAGE_SIZE) {
    $sessionsLimit.set(SIDEBAR_SESSIONS_PAGE_SIZE)
  }
}

// ── Workspace node open/collapse ───────────────────────────────────────────
// Resolve a node's open state against its default (absent = follow default).

export function workspaceNodeOpen(id: string, defaultOpen = true): boolean {
  return $sidebarWorkspaceNodeOpen.get()[id] ?? defaultOpen
}

// Force a node open/collapsed. Stable across a default flip — used by "+ new
// session" to reveal the lane it targets and keep it open once it's populated.
export function setWorkspaceNodeOpen(id: string, open: boolean): void {
  const current = $sidebarWorkspaceNodeOpen.get()

  if (current[id] === open) {
    return
  }

  $sidebarWorkspaceNodeOpen.set({ ...current, [id]: open })
}

// Toggle a repo/worktree/file-tree node relative to its current resolved state.
export function toggleWorkspaceNodeCollapsed(id: string, defaultOpen = true): void {
  setWorkspaceNodeOpen(id, !workspaceNodeOpen(id, defaultOpen))
}

const SIDEBAR_DISMISSED_AUTO_PROJECTS_STORAGE_KEY = 'anakot.desktop.dismissedAutoProjects'
const SIDEBAR_DISMISSED_WORKTREES_STORAGE_KEY = 'anakot.desktop.dismissedWorktrees'

// Auto-derived projects the user has dismissed from the overview. They stay
// out of every surface that lists projects (sidebar + ⌘K). Explicit rows never
// match.
export const $dismissedAutoProjectIds = atom<string[]>(
  storedStringArray(SIDEBAR_DISMISSED_AUTO_PROJECTS_STORAGE_KEY)
)

$dismissedAutoProjectIds.subscribe(ids => persistStringArray(SIDEBAR_DISMISSED_AUTO_PROJECTS_STORAGE_KEY, [...ids]))

// Dismiss ("delete") an auto-derived project from the overview.
export function dismissAutoProject(id: string): void {
  const current = $dismissedAutoProjectIds.get()

  if (!current.includes(id)) {
    $dismissedAutoProjectIds.set([...current, id])
  }
}

// Auto projects dismissed from the overview stay out of every surface that
// lists projects. Explicit rows never match.
export function filterVisibleProjects<T extends { id: string; isAuto?: boolean }>(
  projects: readonly T[],
  dismissedIds: readonly string[] = $dismissedAutoProjectIds.get()
): T[] {
  if (!dismissedIds.length) {
    return projects as T[]
  }

  const dismissed = new Set(dismissedIds)

  return projects.filter(project => !(project.isAuto && dismissed.has(project.id)))
}

// Worktree rows removed from the UI after a `git worktree remove`. The on-disk
// dir is gone but historical sessions still reference its path, so we hide the
// row by id (worktree path) to keep "remove" feeling real.
export const $dismissedWorktreeIds = atom<string[]>(
  storedStringArray(SIDEBAR_DISMISSED_WORKTREES_STORAGE_KEY)
)

$dismissedWorktreeIds.subscribe(ids => persistStringArray(SIDEBAR_DISMISSED_WORKTREES_STORAGE_KEY, [...ids]))

// Hide a worktree row after it's been removed via git.
export function dismissWorktree(id: string): void {
  const current = $dismissedWorktreeIds.get()

  if (!current.includes(id)) {
    $dismissedWorktreeIds.set([...current, id])
  }
}

// A hidden worktree becomes visible again as soon as the user explicitly starts
// or opens work there (for example, selecting an already-checked-out branch).
export function restoreWorktree(id: string): void {
  const current = $dismissedWorktreeIds.get()

  if (current.includes(id)) {
    $dismissedWorktreeIds.set(current.filter(worktreeId => worktreeId !== id))
  }
}

// ── Project overview / repo drag-order ─────────────────────────────────────
// Manual drag-order for the project overview rows (project ids) and, within an
// entered project, the repo subtrees (repo ids) and their worktree/branch lanes
// (lane ids). Persisted so the sidebar keeps the user's arrangement across
// restarts; ids missing from the arrays fall back to backend order (they sort
// first/last per orderByIds semantics in the sidebar).
export const $projectOrderIds = atom<string[]>(storedStringArray(SIDEBAR_PROJECT_ORDER_STORAGE_KEY))
export const $repoOrderIds = atom<string[]>(storedStringArray(SIDEBAR_REPO_ORDER_STORAGE_KEY))

$projectOrderIds.subscribe(ids => persistStringArray(SIDEBAR_PROJECT_ORDER_STORAGE_KEY, [...ids]))
$repoOrderIds.subscribe(ids => persistStringArray(SIDEBAR_REPO_ORDER_STORAGE_KEY, [...ids]))

export function reorderProjects(ids: string[]): void {
  $projectOrderIds.set(ids)
}

export function reorderRepos(ids: string[]): void {
  $repoOrderIds.set(ids)
}
