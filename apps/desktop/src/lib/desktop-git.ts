import type {
  AnakotDiscoveredRepo,
  AnakotGitBaseBranch,
  AnakotGitBranch,
  AnakotGitWorktree
} from '@/types/anakot'

// Local git facade over the Electron bridge. Anakot Desktop runs git through
// window.anakotDesktop (methods flat on the bridge — no `git` sub-object, no
// remote-gateway mode), so this module mirrors the Hermes GitBridge surface the
// projects sidebar consumes: it unwraps the bridge's `{ ok, … }` envelopes into
// the plain values the components expect and THROWS on failure (matching
// Hermes' gitPost semantics) so callers can toast the error.

export interface GitBridge {
  worktreeList: (repoPath: string) => Promise<AnakotGitWorktree[]>
  worktreeAdd: (
    repoPath: string,
    options?: { name?: string; branch?: string; base?: string; existingBranch?: string }
  ) => Promise<{ path: string; branch: string; repoRoot: string }>
  worktreeRemove: (
    repoPath: string,
    worktreePath: string,
    options?: { force?: boolean }
  ) => Promise<{ removed: string }>
  branchSwitch: (repoPath: string, branch: string) => Promise<{ branch: string }>
  branchList: (repoPath: string) => Promise<AnakotGitBranch[]>
  baseBranchList: (repoPath: string) => Promise<AnakotGitBaseBranch[]>
  scanRepos: (roots: string[], options?: { enabled?: boolean; maxDepth?: number; excludePaths?: string[] }) => Promise<AnakotDiscoveredRepo[]>
}

function bridgeError(res: { error?: string } | undefined | null, fallback: string): Error {
  return new Error(res?.error || fallback)
}

export function desktopGit(): GitBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const bridge = window.anakotDesktop

  if (!bridge) {
    return undefined
  }

  return {
    worktreeList: async repoPath => {
      const res = await bridge.gitWorktreeList?.(repoPath)

      if (!res?.ok || !Array.isArray(res.worktrees)) {
        return []
      }

      return res.worktrees
    },

    worktreeAdd: async (repoPath, options) => {
      const res = await bridge.gitWorktreeAdd?.(repoPath, options)

      if (!res?.ok) {
        throw bridgeError(res, 'Failed to create worktree')
      }

      return { branch: res.branch ?? '', path: res.path ?? '', repoRoot: repoPath }
    },

    worktreeRemove: async (repoPath, worktreePath, options) => {
      const res = await bridge.gitWorktreeRemove?.(repoPath, worktreePath, options)

      if (!res?.ok) {
        throw bridgeError(res, 'Failed to remove worktree')
      }

      return { removed: worktreePath }
    },

    branchSwitch: async (repoPath, branch) => {
      const res = await bridge.gitBranchSwitch?.(repoPath, branch)

      if (!res?.ok) {
        throw bridgeError(res, 'Failed to switch branch')
      }

      return { branch }
    },

    branchList: async repoPath => {
      const res = await bridge.gitBranchList?.(repoPath)

      if (!res?.ok || !Array.isArray(res.branches)) {
        return []
      }

      return res.branches.map((b: { name: string; checkedOut?: boolean; isDefault?: boolean; worktreePath?: null | string }) => ({
        name: b.name,
        checkedOut: Boolean(b.checkedOut),
        isDefault: Boolean(b.isDefault),
        worktreePath: b.worktreePath ?? null
      }))
    },

    baseBranchList: async repoPath => {
      const res = await bridge.gitBaseBranchList?.(repoPath)

      if (!res?.ok || !Array.isArray(res.branches)) {
        return []
      }

      return res.branches.map(
        (b: { name: string; isRemote?: boolean; isDefault?: boolean }) => ({
          name: b.name,
          isRemote: Boolean(b.isRemote),
          isDefault: Boolean(b.isDefault)
        })
      )
    },

    scanRepos: async (roots, options) => {
      const res = await bridge.gitScanRepos?.(roots, options)

      if (!res?.ok || !Array.isArray(res.repos)) {
        return []
      }

      return res.repos
    }
  }
}
