// Git-driven project operations for the Desktop Projects sidebar:
// worktree list/add/remove ("Start work" flow) and repo-first filesystem
// discovery. Git is the source of truth; the renderer drives these via the
// typed bridge. Self-contained: spawns git directly, no deps on main.cjs.
//
// Ported from Hermes Desktop's git-worktree-ops.ts / git-repo-scan.ts.
'use strict'

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const fsp = fs.promises

function runGit(gitBin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(gitBin, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30_000
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) {
        resolve(String(stdout || ''))
        return
      }
      const err = new Error(String(stderr || '').trim() || `git ${args[0]} failed (exit ${code})`)
      err.stderr = String(stderr || '')
      reject(err)
    })
  })
}

// Parse `git worktree list --porcelain`. The first record is the main worktree.
function parseWorktrees(out) {
  const trees = []
  let cur = null

  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) trees.push(cur)
      cur = { path: line.slice(9).trim(), branch: null, detached: false, bare: false, locked: false }
    } else if (!cur) {
      continue
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '')
    } else if (line === 'detached') {
      cur.detached = true
    } else if (line === 'bare') {
      cur.bare = true
    } else if (line.startsWith('locked')) {
      cur.locked = true
    }
  }

  if (cur) trees.push(cur)
  return trees
}

async function listWorktrees(repoPath, gitBin) {
  try {
    const out = await runGit(gitBin, ['worktree', 'list', '--porcelain'], repoPath)
    return parseWorktrees(out).map((tree, index) => ({
      path: tree.path,
      branch: tree.branch,
      isMain: index === 0,
      detached: tree.detached,
      locked: tree.locked
    }))
  } catch {
    return []
  }
}

// A git-ref-safe branch name (spaces → "-", drop forbidden chars, trim edges),
// or "" when nothing usable remains. Mirrors the renderer's `gitRef`, so a bad
// value can't reach `git` no matter the caller (the GUI also enforces live).
function sanitizeBranch(name) {
  return String(name || '')
    .replace(/\s+/g, '-')
    .replace(/[^\w./-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-./]+|[-./]+$/g, '')
}

function slugify(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')

  return slug || 'work'
}

const TRUNK_BRANCHES = ['main', 'master']

async function gitLine(gitBin, args, cwd) {
  try {
    return (await runGit(gitBin, args, cwd)).trim()
  } catch {
    return ''
  }
}

async function defaultBranch(gitBin, cwd) {
  const remote = (
    await gitLine(gitBin, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], cwd)
  ).replace(/^origin\//, '')

  if (remote) return remote

  const configured = await gitLine(gitBin, ['config', '--get', 'init.defaultBranch'], cwd)
  if (configured) return configured

  for (const branch of TRUNK_BRANCHES) {
    if (await gitLine(gitBin, ['show-ref', '--verify', `refs/heads/${branch}`], cwd)) {
      return branch
    }
  }

  return ''
}

// A brand-new project folder isn't a git repo — and a freshly-init'd one has no
// commit to branch from — so `git worktree add` would fail. Make the dir a repo
// with a single initial commit (matching `git init` defaults), then the caller
// retries the worktree add.
async function initStandaloneRepo(gitBin, cwd, branch) {
  if (!(await gitLine(gitBin, ['rev-parse', '--is-inside-work-tree'], cwd))) {
    await runGit(gitBin, ['init', '-b', branch || 'main'], cwd)
  }
  if (!(await gitLine(gitBin, ['rev-parse', '--verify', 'HEAD'], cwd))) {
    await runGit(gitBin, ['add', '-A'], cwd)
    await runGit(gitBin, ['commit', '-m', 'Initial commit'], cwd)
  }
}

async function addWorktree(repoPath, options, gitBin) {
  const opts = options || {}
  const name = String(opts.name || '').trim()
  const base = String(opts.base || '').trim()
  const branch = String(opts.branch || '').trim()
  const existingBranch = String(opts.existingBranch || '').trim()

  // "Convert a branch into a worktree": attach an existing branch. If it's the
  // default branch there's nothing to worktree-ify — just switch to it.
  if (existingBranch) {
    const safeExisting = sanitizeBranch(existingBranch)

    if (!safeExisting) {
      throw new Error('Branch name is required.')
    }

    if (safeExisting === (await defaultBranch(gitBin, repoPath))) {
      await runGit(gitBin, ['switch', safeExisting], repoPath)
      return { path: repoPath, branch: safeExisting }
    }

    const slug = slugify(safeExisting)
    const dir = path.join(repoPath, '.worktrees', slug)
    await runGit(gitBin, ['worktree', 'add', dir, safeExisting], repoPath)
    return { path: dir, branch: safeExisting }
  }

  const safeName = sanitizeBranch(name)
  const safeBase = sanitizeBranch(base) || (await defaultBranch(gitBin, repoPath))
  const branchName = sanitizeBranch(branch) || safeName || `hermes/${slugify(name || `work-${Date.now().toString(36)}`)}`
  const slug = safeName || slugify(branchName)
  const target = path.join(repoPath, '.worktrees', slug)

  if (fs.existsSync(target)) {
    throw new Error(`A folder already exists at ${target}`)
  }

  try {
    await runGit(gitBin, ['worktree', 'add', '-b', branchName, target, safeBase], repoPath)
    return { path: target, branch: branchName }
  } catch (worktreeError) {
    // `git worktree add` only works on an existing repo with commits — but a
    // brand-new project folder is often just a plain dir. If the start-point
    // (base branch) doesn't exist, it's standalone: init + initial commit then
    // retry. If the repo HAS the branch, surface the real error.
    const hasBase = Boolean(safeBase && (await gitLine(gitBin, ['show-ref', '--verify', `refs/heads/${safeBase}`], repoPath)))
    if (hasBase) {
      throw worktreeError
    }

    await initStandaloneRepo(gitBin, repoPath, branchName)
    try {
      await runGit(gitBin, ['worktree', 'add', '-b', branchName, target, branchName], repoPath)
    } catch {
      // The worktree already exists after init (branch == the repo's HEAD).
      // Verify the target dir and report success rather than double-adding.
      if (!fs.existsSync(target)) {
        throw worktreeError
      }
    }
    return { path: target, branch: branchName }
  }
}

async function removeWorktree(repoPath, worktreePath, options, gitBin) {
  const force = Boolean(options?.force)
  const deleteBranch = options?.deleteBranch
  const args = ['worktree', 'remove']
  if (force) args.push('--force')
  args.push(worktreePath)
  await runGit(gitBin, args, repoPath)
  if (deleteBranch) {
    await runGit(gitBin, ['branch', '-D', deleteBranch], repoPath)
  }
  return { removed: true }
}

// ── Repo-first discovery ──────────────────────────────────────────────────
const DEFAULT_MAX_DEPTH = 3
const MAX_CONCURRENCY = 32
const JUNK_DIRS = new Set(['Applications', 'Library', 'node_modules', 'site-packages', 'vendor', 'venv'])

function pathApiFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix
}

function normalizeRepoScanPath(rawPath, options = {}) {
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? os.homedir()
  const pathApi = pathApiFor(platform)
  const raw = String(rawPath ?? '').trim()

  if (!raw) return null

  let expanded = raw

  if (raw === '~') {
    expanded = homeDir
  } else if (raw.startsWith('~/') || raw.startsWith('~\\')) {
    expanded = pathApi.join(homeDir, raw.slice(2))
  }

  const absolute = pathApi.isAbsolute(expanded) ? expanded : pathApi.resolve(homeDir, expanded)
  const value = pathApi.normalize(absolute)
  const key = platform === 'win32' ? value.toLocaleLowerCase('en-US') : value

  return { key, value }
}

function repoScanPathIsWithin(candidate, parent, options = {}) {
  const platform = options.platform ?? process.platform
  const pathApi = pathApiFor(platform)
  const candidatePath = normalizeRepoScanPath(candidate, options)
  const parentPath = normalizeRepoScanPath(parent, options)

  if (!candidatePath || !parentPath) return false

  const relative = pathApi.relative(parentPath.key, candidatePath.key)

  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative))
  )
}

async function mapLimit(items, limit, fn) {
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await fn(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
}

/**
 * Scan roots for Git repositories. An empty root list preserves the historical
 * home-directory scan. Disabled discovery returns before resolving home or
 * reading the filesystem.
 */
async function scanGitRepos(roots, options = {}) {
  if (options.enabled === false) {
    return []
  }

  const maxDepthValue = Number(options.maxDepth)
  const maxDepth = Number.isFinite(maxDepthValue) && maxDepthValue >= 0 ? maxDepthValue : DEFAULT_MAX_DEPTH
  const pathOptions = {}
  const requestedRoots = Array.isArray(roots) && roots.length > 0 ? roots : [os.homedir()]

  const searchRoots = [
    ...new Map(
      requestedRoots
        .map(root => normalizeRepoScanPath(root, pathOptions))
        .filter(entry => entry !== null)
        .map(entry => [entry.key, entry.value])
    ).values()
  ]

  const exclusions = (options.excludePaths ?? [])
    .map(excluded => normalizeRepoScanPath(excluded, pathOptions))
    .filter(entry => entry !== null)

  const found = new Map()

  function isExcluded(candidate) {
    return exclusions.some(excluded => repoScanPathIsWithin(candidate, excluded.value, pathOptions))
  }

  async function walk(dir, depth) {
    if (depth > maxDepth || isExcluded(dir)) {
      return
    }

    let entries

    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    const gitDir = entries.find(entry => entry.name === '.git' && entry.isDirectory())

    if (gitDir) {
      try {
        await fsp.access(path.join(dir, '.git', 'HEAD'), fs.constants.R_OK)
      } catch {
        return
      }

      const normalized = normalizeRepoScanPath(dir, pathOptions)

      if (normalized) {
        found.set(normalized.key, {
          root: normalized.value,
          label: path.basename(normalized.value) || normalized.value
        })
      }

      return
    }

    const subdirs = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !JUNK_DIRS.has(entry.name))
      .map(entry => path.join(dir, entry.name))

    await mapLimit(subdirs, MAX_CONCURRENCY, subdir => walk(subdir, depth + 1))
  }

  await mapLimit(searchRoots, MAX_CONCURRENCY, root => walk(root, 0))

  return [...found.values()]
}

// ── Branch helpers (list / switch / base branches) ─────────────────────────
async function listBranches(repoPath, gitBin) {
  try {
    // Enumerate local branches with symbolic HEAD + default detection.
    const out = await runGit(gitBin, ['branch', '--format=%(HEAD) %(refname:short)'], repoPath)
    const names = out
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [head, ...rest] = line.split(' ')
        return { name: rest.join(' '), checkedOut: head === '*' }
      })

    const defaultName = await defaultBranch(gitBin, repoPath)

    // Which branches are checked out in a secondary worktree (path or null).
    const wtLines = await runGit(gitBin, ['worktree', 'list', '--porcelain'], repoPath)
    const checkedOutPaths = new Map()
    let currentWtBranch = null

    for (const line of wtLines.split('\n')) {
      const trimmed = line.trim()

      if (trimmed.startsWith('branch refs/heads/')) {
        currentWtBranch = trimmed.slice('branch refs/heads/'.length)
      } else if (trimmed.startsWith('worktree ')) {
        if (currentWtBranch) {
          checkedOutPaths.set(currentWtBranch, trimmed.slice('worktree '.length))
        }
        currentWtBranch = null
      }
    }

    return names.map(({ name, checkedOut }) => ({
      name,
      checkedOut,
      isDefault: name === defaultName,
      worktreePath: checkedOutPaths.get(name) ?? (checkedOut ? null : null)
    }))
  } catch {
    return []
  }
}

async function listBaseBranches(repoPath, gitBin) {
  const fallback = await defaultBranch(gitBin, repoPath)
  try {
    const remote = await runGit(gitBin, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'], repoPath)
    const local = await runGit(gitBin, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], repoPath)
    const remoteNames = remote
      .split('\n')
      .map(line => line.trim().replace(/^origin\//, ''))
      .filter(Boolean)
    const localNames = local.split('\n').map(line => line.trim()).filter(Boolean)
    const unique = [...new Set([...remoteNames, ...localNames])]
    if (fallback && !unique.includes(fallback)) unique.unshift(fallback)
    return unique.map(name => ({
      name,
      isRemote: remoteNames.includes(name),
      isDefault: name === fallback
    }))
  } catch {
    return fallback ? [{ name: fallback, isRemote: false, isDefault: true }] : []
  }
}

async function switchBranch(repoPath, branch, gitBin) {
  await runGit(gitBin, ['checkout', branch], repoPath)
  return { switched: true, branch }
}

module.exports = {
  listWorktrees,
  addWorktree,
  removeWorktree,
  scanGitRepos,
  listBranches,
  listBaseBranches,
  switchBranch,
  sanitizeBranch,
  slugify,
  // exported for tests
  parseWorktrees,
  normalizeRepoScanPath,
  repoScanPathIsWithin
}
