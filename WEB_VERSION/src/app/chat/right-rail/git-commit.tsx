import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import {
  $gitCommitData,
  $gitCommitState,
  clearGitCommitData,
  type CommitSuggestion,
  setGitCommitResult,
  setGitCommitting,
  setGitDiff,
  setGitError,
  setGitGenerating,
  setGitLoading,
  setGitMessage,
  setGitRepoPath,
  setGitStatus,
  setGitSuggestions,
} from '@/store/git-commit'

type AuxTaskEntry = { task: string; provider: string | null; model: string | null }

const STATUS_LABELS: Record<string, string> = {
  M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied',
  '??': 'Untracked', '!!': 'Ignored',
}

function statusBadge(status: string): string {
  if (status === 'M') return 'bg-yellow-500/20 text-yellow-400'
  if (status === 'A') return 'bg-green-500/20 text-green-400'
  if (status === 'D') return 'bg-red-500/20 text-red-400'
  if (status === '??') return 'bg-blue-500/20 text-blue-400'
  return 'bg-gray-500/20 text-gray-400'
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    feat: 'bg-green-500/20 text-green-400',
    fix: 'bg-red-500/20 text-red-400',
    chore: 'bg-gray-500/20 text-gray-400',
    refactor: 'bg-purple-500/20 text-purple-400',
    docs: 'bg-blue-500/20 text-blue-400',
    test: 'bg-orange-500/20 text-orange-400',
    style: 'bg-pink-500/20 text-pink-400',
  }
  return colors[type] ?? 'bg-gray-500/20 text-gray-400'
}

function formatCommit(s: { type: string; scope?: string; message: string }): string {
  const scope = s.scope ? `(${s.scope})` : ''
  return `${s.type}${scope}: ${s.message}`
}

export function GitCommitPanel() {
  const state = useStore($gitCommitState)
  const repoPath = state.repoPath
  const commitModelRef = useRef<string | null>(null)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [branchName, setBranchName] = useState('')
  const branchInputRef = useRef<HTMLInputElement>(null)

  // Load auxiliary model assignment for commit_gen
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { getAuxiliaryModels } = await import('@/anakot')
        const aux = await getAuxiliaryModels()
        if (!cancelled && aux?.tasks) {
          const task = aux.tasks.find((t: AuxTaskEntry) => t.task === 'commit_gen')
          if (task && task.provider && task.provider !== 'auto') {
            commitModelRef.current = task.model
          } else {
            commitModelRef.current = null
          }
        }
      } catch {
        commitModelRef.current = null
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Load status on mount
  useEffect(() => {
    if (!repoPath) return
    let cancelled = false
    async function load() {
      try {
        const status = await window.anakotDesktop.gitStatus?.(repoPath)
        if (cancelled || !status) return
        setGitStatus({
          root: status.root,
          branch: status.branch,
          files: status.files ?? [],
          error: status.error,
        })
        if (status.files?.length) {
          const diff = await window.anakotDesktop.gitStagedDiff?.(repoPath)
          if (!cancelled && diff?.ok) setGitDiff(diff.diff)
        }
      } catch (e) {
        if (!cancelled) setGitError(String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [repoPath])

  // Focus branch input when dialog opens
  useEffect(() => {
    if (showBranchDialog && branchInputRef.current) {
      branchInputRef.current.focus()
    }
  }, [showBranchDialog])

  const handleGenerate = useCallback(async () => {
    let { diff, files, repoPath: path } = $gitCommitState.get()
    // If diff is not loaded yet (e.g., initial render), try to fetch it now
    if (!diff && path) {
      const diffResult = await window.anakotDesktop.gitStagedDiff?.(path)
      if (diffResult?.ok && diffResult.diff) {
        diff = diffResult.diff
        setGitDiff(diff)
        // Refresh status too so files list is current
        const status = await window.anakotDesktop.gitStatus?.(path)
        if (status) {
          files = status.files ?? []
          setGitStatus({
            root: status.root,
            branch: status.branch,
            files,
            error: status.error,
          })
        }
      } else {
      }
    }
    if (!diff) {
      setGitError('No staged diff available. Stage some changes first.')
      return
    }
    setGitGenerating(true)
    try {
      const model = commitModelRef.current
      const response = await window.anakotDesktop.api<{
        choices?: Array<{ message?: { content?: string } }>
      }>({
        method: 'POST',
        path: '/api/v1/chat/completions',
        body: {
          model: model || undefined,
          messages: [
            {
              role: 'system',
              content: 'You are a git commit message generator. Generate 3-5 concise conventional commit messages (format: type(scope): description) based on the provided git diff. Return them as a JSON array. Each object: {"type":"feat|fix|chore|refactor|docs|test|style","scope":"optional","message":"subject","body":"optional description"}. Return ONLY valid JSON.'
            },
            {
              role: 'user',
              content: `Generate 3-5 conventional commit messages for this diff.

Files changed:
${files.map(f => `[${f.status}] ${f.path}`).join('\n')}

Diff:
\`\`\`diff
${diff.slice(0, 6000)}
\`\`\``
            }
          ],
          max_tokens: 2048,
          temperature: 0.3,
          reasoning_effort: 'low'
        },
        timeoutMs: 30000,
      })

      const content = response?.choices?.[0]?.message?.content
      if (content) {
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as CommitSuggestion[]
            if (Array.isArray(parsed) && parsed.length) {
              setGitSuggestions(parsed)
              setGitMessage(formatCommit(parsed[0]))
              return
            }
          } catch (parseErr) {
          }
        } else {
        }
      }
      setGitError('Could not parse AI response. Try again.')
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleSuggestionClick = useCallback((s: CommitSuggestion) => {
    setGitMessage(formatCommit(s))
  }, [])

  const handleCommit = useCallback(async () => {
    const { message, repoPath: path } = $gitCommitState.get()
    if (!message.trim() || !path) return
    setGitCommitting(true)
    try {
      const result = await window.anakotDesktop.gitCommit?.(path, message.trim())
      if (result?.ok) {
        setGitCommitResult(`✓ Committed: ${message.split('\n')[0].slice(0, 60)}`)
        setGitSuggestions([])
        setGitDiff('')
        // Reload status
        const status = await window.anakotDesktop.gitStatus?.(path)
        if (status) setGitStatus(status)
      } else {
        setGitError(result?.error || 'Commit failed')
      }
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleCommitSync = useCallback(async () => {
    const { message, repoPath: path } = $gitCommitState.get()
    if (!message.trim() || !path) return
    setGitCommitting(true)
    try {
      await setGitMessage(message)
      // Commit first
      const commitResult = await window.anakotDesktop.gitCommit?.(path, message.trim())
      if (!commitResult?.ok) {
        setGitError(commitResult?.error || 'Commit failed')
        return
      }
      // Then push
      const pushResult = await window.anakotDesktop.gitPush?.(path)
      if (pushResult?.ok) {
        setGitCommitResult(`✓ Synced: ${message.split('\n')[0].slice(0, 60)}`)
      } else {
        setGitCommitResult(`✓ Committed (push: ${pushResult?.error || 'failed'})`)
      }
      setGitSuggestions([])
      setGitDiff('')
      const status = await window.anakotDesktop.gitStatus?.(path)
      if (status) setGitStatus(status)
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleCommitAmend = useCallback(async () => {
    const { message, repoPath: path } = $gitCommitState.get()
    if (!path) return
    setGitCommitting(true)
    try {
      const result = await window.anakotDesktop.gitCommitAmend?.(path, message.trim())
      if (result?.ok) {
        setGitCommitResult(`✓ Amended: ${(message || '(no message change)').split('\n')[0].slice(0, 60)}`)
        setGitSuggestions([])
        setGitDiff('')
        const status = await window.anakotDesktop.gitStatus?.(path)
        if (status) setGitStatus(status)
      } else {
        setGitError(result?.error || 'Amend failed')
      }
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleOpenBranchDialog = useCallback(() => {
    setBranchName('')
    setShowBranchDialog(true)
  }, [])

  const handleCreateBranchAndCommit = useCallback(async () => {
    const name = branchName.trim()
    if (!name) return
    const { message, repoPath: path } = $gitCommitState.get()
    if (!message.trim() || !path) return
    setShowBranchDialog(false)
    setGitCommitting(true)
    try {
      // Create and switch to new branch
      const checkoutResult = await window.anakotDesktop.gitCheckoutNewBranch?.(path, name)
      if (!checkoutResult?.ok) {
        setGitError(checkoutResult?.error || 'Branch creation failed')
        return
      }
      // Then commit
      const commitResult = await window.anakotDesktop.gitCommit?.(path, message.trim())
      if (commitResult?.ok) {
        setGitCommitResult(`✓ Created branch "${name}" and committed`)
      } else {
        setGitError(commitResult?.error || 'Commit failed')
      }
      setGitSuggestions([])
      setGitDiff('')
      setBranchName('')
      const status = await window.anakotDesktop.gitStatus?.(path)
      if (status) setGitStatus(status)
    } catch (e) {
      setGitError(String(e))
    }
  }, [branchName])

  const handleRepoSubmit = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>('[data-repo-input]')
    if (input?.value) {
      setGitRepoPath(input.value.trim())
      clearGitCommitData()
    }
  }, [])

  const stagedCount = state.files.filter(f => f.staged).length
  const canCommit = !state.committing && state.message.trim().length > 0 && stagedCount > 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[10px] font-bold font-mono tracking-[0.15em] text-foreground/60">COMMIT</span>
        {state.branch && (
          <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground/60">
            {state.branch}
          </span>
        )}
        <button
          onClick={clearGitCommitData}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Repo path input */}
        {!repoPath && (
          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Enter a repo path to start:</p>
            <div className="flex gap-2">
              <input
                data-repo-input
                className="min-w-0 flex-1 rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                placeholder="D:/repo/.git or /home/user/project"
                onKeyDown={e => { if (e.key === 'Enter') handleRepoSubmit() }}
              />
              <button
                onClick={handleRepoSubmit}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        )}

        {/* Status section */}
        {repoPath && state.loading && (
          <div className="flex items-center justify-center p-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
          </div>
        )}

        {repoPath && !state.loading && !state.error && (
          <>
            {/* Files */}
            <div className="px-3 py-1.5">
              <p className="text-[11px] font-medium text-muted-foreground/70 mb-1">Staged changes ({stagedCount})</p>
              {stagedCount === 0 ? (
                <p className="text-[11px] text-muted-foreground/40 italic">No staged changes</p>
              ) : (
                <div className="space-y-0.5">
                  {state.files.filter(f => f.staged).map(f => (
                    <div key={f.path} className="flex items-center gap-2 text-xs">
                      <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${statusBadge(f.status)}`}>{f.status}</span>
                      <span className="truncate text-foreground/80">{f.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/30" />

            {/* Unstaged files */}
            <div className="px-3 py-1.5">
              <p className="text-[11px] font-medium text-muted-foreground/70 mb-1">Unstaged ({state.files.filter(f => f.unstaged).length})</p>
              {state.files.filter(f => f.unstaged).length === 0 ? (
                <p className="text-[11px] text-muted-foreground/40 italic">No unstaged changes</p>
              ) : (
                <div className="space-y-0.5">
                  {state.files.filter(f => f.unstaged).map(f => (
                    <div key={f.path} className="flex items-center gap-2 text-xs opacity-60">
                      <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${statusBadge(f.status)}`}>{f.status}</span>
                      <span className="truncate">{f.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/30" />

            {/* Generate button + suggestions */}
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={state.generating || stagedCount === 0}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {state.generating ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating...
                    </span>
                  ) : 'Generate Message'}
                </button>
              </div>

              {/* Suggestions */}
              {state.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground/70">Suggestions</p>
                  {state.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full text-left rounded border border-border/30 px-2.5 py-1.5 text-xs hover:bg-accent/10 transition-colors group"
                    >
                      <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold mr-1.5 ${typeColor(s.type)}`}>
                        {s.type}{s.scope ? `(${s.scope})` : ''}
                      </span>
                      <span className="text-foreground/80">{s.message}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/30" />

            {/* Commit message editor */}
            <div className="px-3 py-2 space-y-2">
              <textarea
                value={state.message}
                onChange={e => setGitMessage(e.target.value)}
                placeholder="Commit message..."
                rows={4}
                className="w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none resize-none focus:border-accent font-mono"
              />

              {/* Split-button with dropdown — VS Code style */}
              <div className="flex items-stretch">
                <button
                  onClick={handleCommit}
                  disabled={!canCommit}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-l bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {state.committing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {state.committing && 'Working...'}
                    </span>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M6.5 10.5L3 7l1-1 2.5 2.5L12 3l1 1z" />
                      </svg>
                    </>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={!canCommit}
                      className="flex items-center justify-center rounded-r bg-foreground/90 px-1.5 py-1.5 text-xs font-medium text-background hover:bg-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-l border-background/20"
                    >
                      ▾
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCommit}>
                      Commit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCommitSync}>
                      Commit &amp; Sync
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCommitAmend}>
                      Amend Commit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenBranchDialog}>
                      New Branch...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Branch creation dialog */}
      {showBranchDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border border-border bg-background p-4 shadow-lg w-80">
            <p className="text-xs font-medium text-foreground mb-2">Create new branch:</p>
            <input
              ref={branchInputRef}
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateBranchAndCommit() }}
              className="w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
              placeholder="branch-name"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowBranchDialog(false)}
                className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranchAndCommit}
                disabled={!branchName.trim()}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-40"
              >
                Create &amp; Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
