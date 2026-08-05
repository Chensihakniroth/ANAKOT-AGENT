import { computed, atom } from 'nanostores'

import { desktopGit } from '@/lib/desktop-git'
import { $currentCwd } from '@/store/session'

// Minimal repo-status store for the projects sidebar: only the fields the
// base-branch picker / worktree UI consume (current branch + detached state).
// Ported from Hermes Agent's coding-status.ts, stripped to this surface.

export interface AnakotRepoStatus {
  branch: null | string
  detached: boolean
}

const normalizeCwd = (cwd?: null | string): null | string => cwd?.trim() || null

export const $repoStatusByCwd = atom<Record<string, AnakotRepoStatus | null>>({})

// The PRIMARY (main pane) view — the active session's slice of the per-cwd truth.
export const $repoStatus = computed(
  [$repoStatusByCwd, $currentCwd],
  (byCwd, cwd) => byCwd[normalizeCwd(cwd) ?? ''] ?? null
)

let refreshing: Promise<void> | null = null

/** Probe the current cwd's git branch (off a repo → null status). */
export async function refreshRepoStatus(): Promise<void> {
  if (refreshing) {
    return refreshing
  }

  refreshing = (async () => {
    const cwd = normalizeCwd($currentCwd.get())

    if (!cwd) {
      $repoStatusByCwd.set({ ...$repoStatusByCwd.get(), '': null })

      return
    }

    try {
      const git = desktopGit()

      if (!git?.branchList) {
        $repoStatusByCwd.set({ ...$repoStatusByCwd.get(), [cwd]: null })

        return
      }

      const list = await git.branchList(cwd)
      const branch = list.find(b => b.checkedOut)?.name ?? null

      $repoStatusByCwd.set({ ...$repoStatusByCwd.get(), [cwd]: { branch, detached: false } })
    } catch {
      $repoStatusByCwd.set({ ...$repoStatusByCwd.get(), [cwd]: null })
    }
  })()

  try {
    await refreshing
  } finally {
    refreshing = null
  }
}
