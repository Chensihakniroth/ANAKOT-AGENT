/**
 * Pull Request tracking — maps sessions and branches to their open PRs.
 *
 * Uses `gh pr list` (via the electron bridge) to fetch PRs by branch or number.
 * Caches results with a 60s stale window to avoid hammering the gh CLI.
 */
import { atom } from 'nanostores'

import type { AnakotPullRequest } from '@/lib/desktop-git'
import { desktopGit } from '@/lib/desktop-git'
import { storedStringRecord, persistStringRecord, storedStringArray, persistStringArray } from '@/lib/storage'

/** How a row's PR reads at a glance. */
export type PullRequestBucket = 'closed' | 'draft' | 'merged' | 'none' | 'open'

// `gh pr list` is a network call per repo. Debounce repeated requests.
const PR_STALE_MS = 60_000

/** Every known PR keyed by `${repoRoot}\n${branch}` */
export const $pullRequestsByBranch = atom<Record<string, AnakotPullRequest>>({})

/** Sessions whose PR isn't on the branch they recorded — keyed for lookup (persisted). */
function getPrBranchBySession(): Record<string, string> {
  return storedStringRecord('anakot.desktop.prBranchBySession')
}
function setPrBranchBySession(value: Record<string, string>): void {
  persistStringRecord('anakot.desktop.prBranchBySession', value)
}

/** Sessions already scanned for a PR url (never re-scan, persisted). */
function getPrScannedSessions(): string[] {
  return storedStringArray('anakot.desktop.prScannedSessions')
}
function setPrScannedSessions(value: string[]): void {
  persistStringArray('anakot.desktop.prScannedSessions', value)
}

const fetchedAt = new Map<string, number>()
const inFlight = new Set<string>()
let scanUnavailable = false
let scanInFlight = false

// Trunk branches have no PR of their own
const TRUNK_BRANCHES = new Set(['dev', 'develop', 'main', 'master', 'trunk'])

export const branchPrKey = (repoRoot: string, branch: string): string => `${repoRoot}\n${branch}`
export const numberPrKey = (repoRoot: string, number: number): string => `${repoRoot}\n#${number}`

export function sessionPrKey(session: { git_repo_root?: string | null; git_branch?: string | null; id: string }): null | string {
  const stamped = getPrBranchBySession()[session.id]

  if (stamped) {
    return stamped
  }

  const root = session.git_repo_root
  const branch = session.git_branch

  return root && branch && !TRUNK_BRANCHES.has(branch.toLowerCase()) ? branchPrKey(root, branch) : null
}

/** Bind a session to the branch it just opened a PR from. */
export function stampSessionPrBranch(sessionId: string, repoRoot: string, branch: string): void {
  if (!sessionId || !repoRoot || !branch) {
    return
  }

  setPrBranchBySession({ ...getPrBranchBySession(), [sessionId]: branchPrKey(repoRoot, branch) })
}

/** Recover PRs the branch join can't see, from sessions' own transcripts. */
export async function recoverSessionPullRequests(
  sessions: Array<{ id: string; git_repo_root?: string | null; transcript?: string }>
): Promise<void> {
  const scanned = new Set(getPrScannedSessions())
  const roots = new Map<string, string>()

  for (const session of sessions) {
    if (session.git_repo_root && !scanned.has(session.id) && !sessionPrKey(session)) {
      roots.set(session.id, session.git_repo_root)
    }
  }

  if (roots.size === 0 || scanUnavailable || scanInFlight) {
    return
  }

  scanInFlight = true

  try {
    // Scan transcripts for PR URLs (e.g. https://github.com/org/repo/pull/123)
    const prUrlRegex = /https?:\/\/github\.com\/[^\s]+\/pull\/(\d+)/gi
    const stamps = { ...getPrBranchBySession() }
    const asked: string[] = []

    for (const [id, root] of roots) {
      asked.push(id)
      const session = sessions.find(s => s.id === id)
      if (session?.transcript) {
        let match
        while ((match = prUrlRegex.exec(session.transcript)) !== null) {
          const prNumber = Number(match[1])
          stamps[id] = numberPrKey(root, prNumber)
          break // Only take the first PR URL found
        }
      }
    }

    setPrBranchBySession(stamps)
    setPrScannedSessions([...new Set([...scanned, ...asked])])
  } catch {
    scanUnavailable = true
  } finally {
    scanInFlight = false
  }
}

export function pullRequestBucket(pr: AnakotPullRequest | undefined): PullRequestBucket {
  if (!pr) {
    return 'none'
  }

  if (pr.state === 'merged') {
    return 'merged'
  }

  if (pr.state === 'closed') {
    return 'closed'
  }

  return pr.draft ? 'draft' : 'open'
}

/**
 * Pull PRs for the given lookups, grouped by the repo they live in. Each entry
 * is a branch name, or `#<number>` for a PR recovered from a transcript. Skips
 * repos fetched recently or still in flight.
 */
export async function refreshPullRequests(
  lookupsByRepo: Record<string, string[]>,
  force = false
): Promise<void> {
  const review = desktopGit()?.review

  if (!review) {
    return
  }

  const now = Date.now()

  const stale = Object.keys(lookupsByRepo).filter(
    root => !inFlight.has(root) && (force || now - (fetchedAt.get(root) ?? 0) > PR_STALE_MS)
  )

  await Promise.all(
    stale.map(async root => {
      inFlight.add(root)

      const lookups = lookupsByRepo[root]
      const numbers = lookups.filter(l => l.startsWith('#')).map(l => Number(l.slice(1)))

      try {
        const prs = await review.prList(
          root,
          lookups.filter(l => !l.startsWith('#')),
          numbers
        )

        fetchedAt.set(root, now)

        // Replace this repo's slice wholesale
        const next = Object.fromEntries(
          Object.entries($pullRequestsByBranch.get()).filter(([key]) => !key.startsWith(`${root}\n`))
        )

        for (const pr of prs) {
          next[branchPrKey(root, pr.branch)] = pr

          if (numbers.includes(pr.number)) {
            next[numberPrKey(root, pr.number)] = pr
          }
        }

        $pullRequestsByBranch.set(next)
      } catch {
        // gh missing, unauthenticated, or off-repo — leave what we had
        fetchedAt.set(root, now)
      } finally {
        inFlight.delete(root)
      }
    })
  )
}