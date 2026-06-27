// Git Service — runs git commands directly in the main process.
// This module is imported by electron/main.cjs to handle IPC calls.
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const IS_WINDOWS = process.platform === 'win32'

function resolveGitBinary(): string {
  // In packaged apps or on Windows, rely on PATH or bundled git.
  return process.env.ANAKOT_GIT_BINARY || 'git'
}

function runGit(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(resolveGitBinary(), args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: IS_WINDOWS,
      })
    } catch (error) {
      resolve({ ok: false, stdout: '', stderr: error?.message || 'spawn failed' })
      return
    }

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr: stderr || error.message || 'child error' })
    })

    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() })
    })
  })
}

function findGitRoot(startDir: string): string | null {
  let dir = startDir

  for (let i = 0; i < 50; i++) {
    const dotGit = path.join(dir, '.git')
    try {
      if (fs.existsSync(dotGit)) {
        return dir
      }
    } catch {
      return null
    }

    const parent = path.dirname(dir)
    if (parent === dir) {
      // Reached filesystem root, stop.
      return null
    }
    dir = parent
  }

  return null
}

export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

export interface GitStatusResult {
  root: string | null
  branch: string
  files: GitFileStatus[]
  ahead: number
  behind: number
  error?: string
}

export async function gitStatus(cwd: string): Promise<GitStatusResult> {
  const root = findGitRoot(cwd)
  if (!root) {
    return { root: null, branch: '', files: [], ahead: 0, behind: 0 }
  }

  // Run git status with porcelain output and branch info.
  const [statusResult, branchResult, aheadBehind] = await Promise.all([
    runGit(['status', '--porcelain', '--untracked-files=all'], root),
    runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root),
    runGit(['rev-list', '--left-right', '--count', '...@{upstream}'], root).catch(() => ({ ok: true, stdout: '', stderr: '' })),
  ])

  const statusStr = statusResult.stdout
  const branch = branchResult.ok ? branchResult.stdout : ''

  let ahead = 0
  let behind = 0
  if (aheadBehind.ok && aheadBehind.stdout) {
    const parts = aheadBehind.stdout.trim().split(/\s+/)
    if (parts.length === 2) {
      ahead = parseInt(parts[0], 10) || 0
      behind = parseInt(parts[1], 10) || 0
    }
  }

  if (!statusStr) {
    return { root, branch, files: [], ahead, behind }
  }

  const statusMap: Record<string, GitFileStatus['status']> = {
    'M': 'modified',
    'A': 'added',
    'D': 'deleted',
    'R': 'renamed',
    '?': 'untracked',
  }

  const files = statusStr
    .split('\n')
    .filter(Boolean)
    .map((line): GitFileStatus => {
      const indexStatus = line[0]
      const workStatus = line[1]
      const filePath = line.slice(2)

      let status: GitFileStatus['status'] = 'modified'
      const isUntracked = indexStatus === '?' || workStatus === '?'
      const isStaged = indexStatus !== ' ' && indexStatus !== '?'

      if (isUntracked) status = 'untracked'
      else if (indexStatus === 'A') status = 'added'
      else if (indexStatus === 'D' || workStatus === 'D') status = 'deleted'
      else if (indexStatus === 'R') status = 'renamed'
      else status = statusMap[indexStatus] || 'modified'

      return { path: filePath, status, staged: isStaged }
    })

  return { root, branch, files, ahead, behind }
}

export interface GitCommitResult {
  ok: boolean
  output?: string
  error?: string
}

export async function gitStageAll(cwd: string, files: string[]): Promise<GitCommitResult> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: false, error: 'not a git repo' }
  return runGit(['add', ...files], root)
}

export async function gitStageFile(cwd: string, file: string): Promise<GitCommitResult> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: false, error: 'not a git repo' }
  return runGit(['add', '--', file], root)
}

export async function gitUnstageFile(cwd: string, file: string): Promise<GitCommitResult> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: false, error: 'not a git repo' }
  return runGit(['reset', 'HEAD', '--', file], root)
}

export async function gitDiscardFile(cwd: string, file: string): Promise<GitCommitResult> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: false, error: 'not a git repo' }
  return runGit(['restore', '--', file], root)
}

export async function gitCommit(cwd: string, message: string): Promise<GitCommitResult> {
  if (!message?.trim()) return { ok: false, error: 'empty commit message' }
  const root = findGitRoot(cwd)
  if (!root) return { ok: false, error: 'not a git repo' }
  return runGit(['commit', '-m', message], root)
}

export async function gitDiff(cwd: string, file: string): Promise<{ ok: boolean; diff: string }> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: true, diff: '' }
  const result = await runGit(['diff', '--', file], root)
  return { ok: result.ok, diff: result.stdout }
}

export interface GitCommitInfo {
  hash: string
  author: string
  date: string
  message: string
}

export async function gitLog(cwd: string, limit = 30): Promise<{ ok: boolean; commits: GitCommitInfo[] }> {
  const root = findGitRoot(cwd)
  if (!root) return { ok: true, commits: [] }
  const result = await runGit([
    'log',
    `--max-count=${limit}`,
    '--pretty=format:%h|%an|%ad|%s',
    '--date=iso',
  ], root)

  if (!result.ok || !result.stdout) return { ok: true, commits: [] }

  const commits = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line): GitCommitInfo => {
      const [hash, author, date, ...rest] = line.split('|')
      return { hash: hash || '', author: author || '', date: date || '', message: rest.join('|') }
    })

  return { ok: true, commits }
}
