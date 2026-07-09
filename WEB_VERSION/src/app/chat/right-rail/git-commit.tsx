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
    console.log('[GitCommit] Generate clicked — reading state')
    let { diff, files, repoPath: path } = $gitCommitState.get()
    console.log('[GitCommit] State:', { hasDiff: !!diff, fileCount: files.length, stagedCount: files.filter(f => f.staged).length, path })
    // If diff is not loaded yet (e.g., initial render), try to fetch it now
    if (!diff && path) {
      console.log('[GitCommit] No diff in store — re-fetching staged diff')
      const diffResult = await window.anakotDesktop.gitStagedDiff?.(path)
      console.log('[GitCommit] Staged diff result:', JSON.stringify({ ok: diffResult?.ok, hasDiff: !!diffResult?.diff, len: diffResult?.diff?.length }))
      if (diffResult?.ok && diffResult.diff) {
        diff = diffResult.diff
        setGitDiff(diff)
        console.log('[GitCommit] Diff fetched on-demand, length:', diff.length)
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
          console.log('[GitCommit] Status refreshed:', { branch: status.branch, fileCount: files.length })
        }
      } else {
        console.log('[GitCommit] Staged diff fetch failed or empty:', diffResult?.error)
      }
    }
    if (!diff) {
      console.log('[GitCommit] Aborting — no diff available')
      setGitError('No staged diff available. Stage some changes first.')
      return
    }
    setGitGenerating(true)
    console.log('[GitCommit] Generating commit messages — model:', commitModelRef.current, 'diff length:', diff.length)
    try {
      const model = commitModelRef.current
      console.log('[GitCommit] Sending API request — model:', model || '(default)', 'timeout: 30000ms')
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
      console.log('[GitCommit] API response received:', JSON.stringify({
        type: typeof response,
        hasChoices: !!response?.choices?.length,
        firstChoiceHasContent: !!response?.choices?.[0]?.message?.content,
        contentPreview: response?.choices?.[0]?.message?.content?.slice(0, 100),
      }))

      const content = response?.choices?.[0]?.message?.content
      console.log('[GitCommit] Parsing response content:', { hasContent: !!content, rawLength: content?.length })
      if (content) {
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        console.log('[GitCommit] JSON array match:', { found: !!jsonMatch, matchedLength: jsonMatch?.[0]?.length })
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as CommitSuggestion[]
            console.log('[GitCommit] Parsed suggestions:', { count: parsed?.length, isValidArray: Array.isArray(parsed) })
            if (Array.isArray(parsed) && parsed.length) {
              setGitSuggestions(parsed)
              setGitMessage(formatCommit(parsed[0]))
              console.log('[GitCommit] ✅ Success — first suggestion:', formatCommit(parsed[0]))
              return
            }
          } catch (parseErr) {
            console.log('[GitCommit] JSON parse error:', String(parseErr))
          }
        } else {
          console.log('[GitCommit] No JSON array pattern found in response')
        }
      }
      console.log('[GitCommit] Falling through to error path')
      setGitError('Could not parse AI response. Try again.')
    } catch (e) {
      console.log('[GitCommit] API call error:', String(e))
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
                      Commit
                    </>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={!canCommit}
                      className="flex items-center justify-center rounded-r border-l border-background/20 bg-foreground/90 px-2 py-1.5 text-background hover:bg-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Commit options"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 6l4 4 4-4H4z" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
                    <DropdownMenuItem onClick={handleCommit} className="flex items-center gap-2 text-xs">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M6.5 10.5L3 7l1-1 2.5 2.5L12 3l1 1z" />
                      </svg>
                      <span>Commit</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/50">Ctrl+Enter</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCommitSync} className="flex items-center gap-2 text-xs">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M3 8c0-2.2 1.8-4 4-4h2V2l4 3-4 3V6H7c-1.1 0-2 .9-2 2s.9 2 2 2h4v2H7c-2.2 0-4-1.8-4-4z" />
                        <path d="M11 10h2v4h-2z" />
                      </svg>
                      <span>Commit & Sync</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCommitAmend} className="flex items-center gap-2 text-xs">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M10.5 1c.3 0 .5.2.5.5V3h2c.6 0 1 .4 1 1v9c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1h2V1.5c0-.3.2-.5.5-.5s.5.2.5.5V3h4V1.5c0-.3.2-.5.5-.5zM3 4v9h10V4H3zm4 3h2v1H7V7zm0 2h2v1H7V9zm0 2h2v1H7v-1z" />
                      </svg>
                      <span>Commit (Amend)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenBranchDialog} className="flex items-center gap-2 text-xs">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M14 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM4 2C2.9 2 2 2.9 2 4s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 2.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zM12 4c0 .3-.2.5-.5.5s-.5-.2-.5-.5.2-.5.5-.5.5.2.5.5zM4 4c0 .3-.2.5-.5.5S3 4.3 3 4s.2-.5.5-.5S4 3.7 4 4zm.3 6.3l6-6 .7.7-6 6-.7-.7z" />
                      </svg>
                      <span>Commit & Create Branch</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {state.error && (
          <div className="mx-3 my-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-400">{state.error}</p>
          </div>
        )}

        {/* Result */}
        {state.commitResult && (
          <div className="mx-3 my-2 rounded border border-green-500/30 bg-green-500/10 px-3 py-2">
            <p className="text-xs text-green-400">{state.commitResult}</p>
          </div>
        )}
      </div>

      {/* Branch name dialog overlay */}
      {showBranchDialog && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowBranchDialog(false)}
        >
          <div
            className="mx-3 w-full max-w-xs rounded-lg border border-border/60 bg-background p-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="mb-3 text-xs font-medium text-foreground">New Branch Name</p>
            <input
              ref={branchInputRef}
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateBranchAndCommit()
                if (e.key === 'Escape') setShowBranchDialog(false)
              }}
              className="w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent mb-3"
              placeholder="feature/my-new-feature"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBranchDialog(false)}
                className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranchAndCommit}
                disabled={!branchName.trim() || !state.message.trim()}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-40 transition-colors"
              >
                Create & Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCommit(s: CommitSuggestion): string {
  let msg = `${s.type}`
  if (s.scope) msg += `(${s.scope})`
  msg += `: ${s.message}`
  if (s.body) msg += `\n\n${s.body}`
  return msg
}
