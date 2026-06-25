import { atom } from 'nanostores'

export type GitLogLevel = 'info' | 'success' | 'warning' | 'error'

export interface GitLogEntry {
  id: string
  timestamp: number
  level: GitLogLevel
  /** The git command that was run, e.g. "git add" */
  command: string
  /** Full command + args */
  fullCommand: string
  /** Working directory */
  cwd: string
  /** stdout output */
  stdout: string
  /** stderr output */
  stderr: string
  /** Exit code */
  exitCode: number
  /** Short summary line */
  summary: string
}

const MAX_LOG_ENTRIES = 200

export const $gitLog = atom<GitLogEntry[]>([])

let logIdCounter = 0

function nextLogId(): string {
  logIdCounter += 1
  return `git-log-${Date.now()}-${logIdCounter}`
}

export function addGitLogEntry(entry: Omit<GitLogEntry, 'id' | 'timestamp'>): GitLogEntry {
  const fullEntry: GitLogEntry = {
    ...entry,
    id: nextLogId(),
    timestamp: Date.now(),
  }
  const prev = $gitLog.get()
  const next = [...prev, fullEntry].slice(-MAX_LOG_ENTRIES)
  $gitLog.set(next)
  return fullEntry
}

export function clearGitLog(): void {
  $gitLog.set([])
}
