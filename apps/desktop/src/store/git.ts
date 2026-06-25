import { atom } from 'nanostores'
import { addGitLogEntry } from './git-log'

export interface GitFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'unmerged'
  staged: boolean
  unstaged: boolean
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

// Normalize a path for safe IPC transport.
// Windows backslashes can be lost during IPC serialization,
// so we convert to forward slashes and restore on the other side.
function toIpcSafePath(p: string): string {
  return p.replace(/\\/g, '/')
}

// ── Auto-refresh polling ─────────────────────────────────────────────────────

let refreshTimer: ReturnType<typeof setInterval> | null = null
let lastRefreshCwd: string = ''

function startPolling(cwd: string) {
  stopPolling()
  if (!cwd.trim()) return
  lastRefreshCwd = cwd
  // Poll every 5 seconds — same as VS Code default
  refreshTimer = setInterval(() => {
    if (lastRefreshCwd) {
      void refreshGitStatus(lastRefreshCwd, { silent: true })
    }
  }, 5000)
}

function stopPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/** Manually trigger a status refresh (e.g. after a file save) */
export function triggerGitRefresh() {
  if (lastRefreshCwd) {
    void refreshGitStatus(lastRefreshCwd, { silent: true })
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

  // Start polling on first call
  if (!refreshTimer && cwd.trim()) {
    startPolling(cwd.trim())
  }

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
    if (!options?.silent) {
      $gitLoading.set(false)
    }
  }
}

export async function gitStageFile(cwd: string, file: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  try {
    const result = await window.anakotDesktop?.gitAdd?.(safePath, [file])
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
  }
}

export async function gitStageAllFiles(cwd: string, files: string[]) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  try {
    const result = await window.anakotDesktop?.gitAdd?.(safePath, files)
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
  }
}

export async function gitUnstageFile(cwd: string, file: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  try {
    const result = await window.anakotDesktop?.gitRestore?.(safePath, [file])
    if (result) {
      addGitLogEntry({
        command: 'restore',
        fullCommand: `git restore --staged --worktree ${file}`,
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
    const msg = e instanceof Error ? e.message : 'git restore failed'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'restore',
      fullCommand: `git restore --staged --worktree ${file}`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  }
}

export async function gitDiscardChanges(cwd: string, file: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
  try {
    const result = await window.anakotDesktop?.gitRestore?.(safePath, [file])
    if (result) {
      addGitLogEntry({
        command: 'restore',
        fullCommand: `git restore --staged --worktree ${file}`,
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
    const msg = e instanceof Error ? e.message : 'git restore failed'
    $gitError.set(msg)
    addGitLogEntry({
      command: 'restore',
      fullCommand: `git restore --staged --worktree ${file}`,
      cwd,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      level: 'error',
      summary: msg,
    })
    return { ok: false, error: msg }
  }
}

export async function gitCommit(cwd: string, message: string) {
  const safePath = toIpcSafePath(cwd)
  $gitError.set(null)
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
