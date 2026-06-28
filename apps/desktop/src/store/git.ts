import { atom } from 'nanostores'
import { addGitLogEntry } from './git-log'

export interface GitFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'unmerged'
  staged: boolean
}

function normalizeStatus(raw: string): GitFile['status'] {
  switch (raw) {
    case 'modified': return 'modified'
    case 'added': return 'added'
    case 'deleted': return 'deleted'
    case 'renamed': return 'renamed'
    case 'untracked': return 'untracked'
    case 'unmerged': return 'unmerged'
    default: return 'modified'
  }
}

export interface GitCommit {
  hash: string
  name: string
  email: string
  date: string
  message: string
}

export const $gitStatus = atom<{
  root: string | null
  files: GitFile[]
  branch: string
  error?: string
}>({ root: null, files: [], branch: '' })

export const $gitError = atom<string | null>(null)
export const $gitCommits = atom<GitCommit[]>([])
export const $gitLoading = atom(false)
export const $gitCommitMessage = atom('')
export const $gitBranches = atom<{name: string, current: boolean}[]>([])

// Normalize a path for safe IPC transport.
// Windows backslashes can be lost during IPC serialization,
// so we convert to forward slashes and restore on the other side.
function toIpcSafePath(p: string): string {
  return p.replace(/\\/g, '/')
}

// ── Auto-refresh polling ─────────────────────────────────────────────────────

let refreshTimer: ReturnType<typeof setInterval> | null = null
let lastRefreshCwd: string = ''
// Per-workspace busy flag — keyed by cwd. Allows multiple workspace tabs.
const busyMap = new Map<string, boolean>()

function isBusy(cwd: string): boolean {
  return busyMap.get(cwd) === true
}
function setBusy(cwd: string, value: boolean) {
  if (value) busyMap.set(cwd, true)
  else busyMap.delete(cwd)
}

function startPolling(cwd: string, intervalMs = 60000) {
  stopPolling()
  if (!cwd.trim()) return
  lastRefreshCwd = cwd
  // Poll at the given interval — default 60s is a fallback safety net.
  // The primary mechanism is the OS-level file watcher (see main process).
  refreshTimer = setInterval(() => {
    if (lastRefreshCwd && !isBusy(lastRefreshCwd)) {
      void refreshGitStatus(lastRefreshCwd, { silent: true })
    }
  }, intervalMs)
}

function stopPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

let isListenerRegistered = false

/**
 * Call this when cwd changes from the UI.
 * Stops old polling, refreshes status for new cwd, starts fallback polling.
 */
export function changeWorkspace(cwd: string) {
  if (!isListenerRegistered && typeof window !== 'undefined' && window.anakotDesktop?.onGitChanged) {
    isListenerRegistered = true
    window.anakotDesktop.onGitChanged(() => {
      triggerGitRefresh()
    })
  }

  setBusy(cwd, false)
  busyMap.delete(lastRefreshCwd)
  stopPolling()
  if (cwd.trim()) {
    void refreshGitStatus(cwd)
    // Fallback polling: only fires if file watcher misses something.
    // Longer interval (60s) since watcher is the primary mechanism.
    startPolling(cwd, 60000)
  }
}

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null

/** Manually trigger a status refresh (e.g. after a file save or file-watcher event) */
export function triggerGitRefresh(cwd?: string) {
  const target = cwd || lastRefreshCwd
  if (target && !isBusy(target)) {
    if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer)
    refreshDebounceTimer = setTimeout(() => {
      void refreshGitStatus(target, { silent: true })
    }, 500)
  }
}

// ── Git operations with logging ──────────────────────────────────────────────

function buildLogSummary(command: string, files?: string[]): string {
  if (command === 'status') return 'git status'
  if (command === 'add') {
    const count = files?.length ?? 0
    return `git add (${count} ${count === 1 ? 'file' : 'files'})`
  }
  if (command === 'restore') {
    const count = files?.length ?? 0
    return `git restore (${count} ${count === 1 ? 'file' : 'files'})`
  }
  if (command === 'commit') return 'git commit'
  if (command === 'diff') return `git diff ${files?.[0] ?? ''}`
  if (command === 'log') return 'git log'
  return `git ${command}`
}

function determineLevel(exitCode: number, stderr: string): 'success' | 'error' | 'warning' {
  if (exitCode === 0) return 'success'
  if (stderr && exitCode !== 0) return 'error'
  return 'warning'
}

export async function refreshGitStatus(cwd: string, options?: { silent?: boolean }) {
  if (!cwd.trim()) return
  const safePath = toIpcSafePath(cwd.trim())

  if (!options?.silent) {
    $gitLoading.set(true)
  }
  $gitError.set(null)

  try {
    const result = await window.anakotDesktop?.gitStatus?.(safePath)

    // Log the status check
    if (result) {
      addGitLogEntry({
        command: 'status',
        fullCommand: 'git status --porcelain',
        cwd: cwd.trim(),
        stdout: result.files?.map(f => `${f.status} ${f.path}`).join('\n') || '',
        stderr: result.error || '',
        exitCode: result.error ? 1 : 0,
        level: result.error ? 'error' : 'success',
        summary: result.error || `Status: ${result.files?.length ?? 0} changed files`,
      })
    }

    if (result) {
      if (result.error) {
        $gitError.set(result.error)
      }
      $gitStatus.set({
        ...result,
        files: result.files.map(f => ({ ...f, status: normalizeStatus(f.status) }))
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load git status'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'status',
      fullCommand: 'git status',
      cwd: cwd.trim(),
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
  } finally {
    $gitLoading.set(false)
  }
}

export async function gitLoadBranches(cwd: string) {
  if (!cwd.trim()) return
  const safePath = toIpcSafePath(cwd.trim())
  try {
    const result = await window.anakotDesktop?.gitBranches?.(safePath)
    if (result && result.ok && result.branches) {
      $gitBranches.set(result.branches)
    } else {
      $gitError.set(result?.error || 'Failed to load branches')
    }
  } catch (e) {
    $gitError.set(e instanceof Error ? e.message : 'Failed to load branches')
  }
}

export async function gitCheckoutBranch(cwd: string, branch: string): Promise<{ ok: boolean, error?: string }> {
  if (!cwd.trim() || !branch.trim()) return { ok: false, error: 'invalid arguments' }
  const safePath = toIpcSafePath(cwd.trim())
  $gitError.set(null)
  setBusy(cwd, true)
  try {
    const result = await window.anakotDesktop?.gitCheckout?.(safePath, branch)
    if (result && result.ok) {
      void triggerGitRefresh(cwd)
      void gitLoadBranches(cwd)
      return { ok: true }
    } else {
      $gitError.set(result?.error || 'Failed to checkout branch')
      return { ok: false, error: result?.error || 'Failed to checkout branch' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to checkout branch'
    $gitError.set(msg)
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitStageFile(cwd: string, file: string) {
  console.log('[gitStore] gitStageFile called:', { cwd, file })
  const safePath = toIpcSafePath(cwd)
  console.log('[gitStore] gitAdd IPC call with safePath:', safePath, 'files:', [file])
  $gitError.set(null)
  setBusy(cwd, true)
  try {
    const result = await window.anakotDesktop?.gitAdd?.(safePath, [file])
    console.log('[gitStore] gitAdd result:', result)
    if (result) {
      addGitLogEntry({
        command: 'add',
        fullCommand: `git add ${file}`,
        cwd,
        stdout: result.ok ? `Staged: ${file}` : '',
        stderr: result.error || '',
        exitCode: result.ok ? 0 : 1,
        level: determineLevel(result.ok ? 0 : 1, result.error || ''),
        summary: result.ok ? `Staged ${file}` : result.error || `Failed to stage ${file}`,
      })
    }
    if (result?.ok) {
      await refreshGitStatus(cwd)
    } else if (result?.error) {
      $gitError.set(result.error)
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'git add failed'
    console.log('[gitStore] gitStageFile error:', msg)
    $gitError.set(msg)
    addGitLogEntry({
      command: 'add',
      fullCommand: `git add ${file}`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitStageAllFiles(cwd: string, files: string[]) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  setBusy(cwd, true)
  console.log('[store] gitStageAllFiles safePath:', safePath, 'files:', files.length)
  try {
    const result = await window.anakotDesktop?.gitAdd?.(safePath, files)
    console.log('[store] gitStageAllFiles result:', JSON.stringify(result))
    if (result) {
      addGitLogEntry({
        command: 'add',
        fullCommand: `git add ${files.length} files`,
        cwd,
        stdout: result.ok ? `Staged ${files.length} files` : '',
        stderr: result.error || '',
        exitCode: result.ok ? 0 : 1,
        level: determineLevel(result.ok ? 0 : 1, result.error || ''),
        summary: result.ok ? `Staged ${files.length} files` : result.error || `Failed to stage files`,
      })
    }
    if (result?.ok) {
      await refreshGitStatus(cwd)
    } else if (result?.error) {
      $gitError.set(result.error)
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'git add failed'
    console.log('[store] gitStageAllFiles error:', msg)
    $gitError.set(msg)
    addGitLogEntry({
      command: 'add',
      fullCommand: `git add ${files.length} files`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitUnstageFile(cwd: string, file: string) {
  console.log('[gitStore] gitUnstageFile called:', { cwd, file })
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  setBusy(cwd, true)
  try {
    const result = await window.anakotDesktop?.gitUnstage?.(safePath, [file])
    console.log('[gitStore] gitUnstage result:', result)
    if (result) {
      addGitLogEntry({
        command: 'unstage',
        fullCommand: `git reset HEAD -- ${file}`,
        cwd,
        stdout: result.ok ? `Unstaged: ${file}` : '',
        stderr: result.error || '',
        exitCode: result.ok ? 0 : 1,
        level: determineLevel(result.ok ? 0 : 1, result.error || ''),
        summary: result.ok ? `Unstaged ${file}` : result.error || `Failed to unstage ${file}`,
      })
    }
    if (result?.ok) {
      await refreshGitStatus(cwd)
    } else if (result?.error) {
      $gitError.set(result.error)
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'git unstage failed'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'unstage',
      fullCommand: `git reset HEAD -- ${file}`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitDiscardChanges(cwd: string, file: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  setBusy(cwd, true)
  try {
    const result = await window.anakotDesktop?.gitDiscard?.(safePath, [file])
    if (result) {
      addGitLogEntry({
        command: 'discard',
        fullCommand: `git restore -- ${file}`,
        cwd,
        stdout: result.ok ? `Discarded: ${file}` : '',
        stderr: result.error || '',
        exitCode: result.ok ? 0 : 1,
        level: determineLevel(result.ok ? 0 : 1, result.error || ''),
        summary: result.ok ? `Discarded ${file}` : result.error || `Failed to discard ${file}`,
      })
    }
    if (result?.ok) {
      await refreshGitStatus(cwd)
    } else if (result?.error) {
      $gitError.set(result.error)
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'git discard failed'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'discard',
      fullCommand: `git restore -- ${file}`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitCommit(cwd: string, message: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  setBusy(cwd, true)
  try {
    const result = await window.anakotDesktop?.gitCommit?.(safePath, message)
    if (result) {
      addGitLogEntry({
        command: 'commit',
        fullCommand: `git commit -m "${message}"`,
        cwd,
        stdout: result.output || (result.ok ? 'Commit successful' : ''),
        stderr: result.error || '',
        exitCode: result.ok ? 0 : 1,
        level: determineLevel(result.ok ? 0 : 1, result.error || ''),
        summary: result.ok ? `Committed: ${message}` : result.error || 'Commit failed',
      })
    }
    if (result?.ok) {
      $gitCommitMessage.set('')
      await refreshGitStatus(cwd)
    } else if (result?.error) {
      $gitError.set(result.error)
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'git commit failed'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'commit',
      fullCommand: `git commit -m "${message}"`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  } finally {
    setBusy(cwd, false)
  }
}

export async function gitLoadCommits(cwd: string, limit = 20) {
  if (!cwd.trim()) return
  const safePath = toIpcSafePath(cwd)
  try {
    const result = await window.anakotDesktop?.gitLog?.(safePath, limit)
    if (result?.ok && result.commits) {
      $gitCommits.set(result.commits)
    }
    // Log the log operation (non-critical, only on error)
    if (result && !result.ok) {
      addGitLogEntry({
        command: 'log',
        fullCommand: `git log --max-count=${limit}`,
        cwd,
        stdout: '',
        stderr: result.error || '',
        exitCode: 1,
        level: 'error',
        summary: result.error || 'git log failed',
      })
    }
  } catch {
    // ignore
  }
}
