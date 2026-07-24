import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PromptDialog } from '@/components/ui/prompt-dialog'

import {
  $gitCommitState,
  clearGitCommitData,
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
  type GitStatusEntry,
} from '@/store/git-commit'
import {
  $reviewSelectedPath,
  $reviewDiffLines,
  $reviewViewMode,
  $reviewLoadingDiff,
  $reviewDiffError,
  $reviewCollapsedDirs,
  selectReviewFile,
  clearReviewSelection,
  toggleReviewDir,
  setReviewViewMode,
  type ReviewViewMode,
} from '@/store/review'
import { buildReviewTree, buildReviewFlatList, type ReviewTreeNode } from './tree-data'

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied',
  '??': 'Untracked', '!!': 'Ignored',
}

function statusBadge(status: string): string {
  // Handle both raw git porcelain ('??') and normalized ('untracked')
  const s = status === '??' ? 'untracked' : status === '!!' ? 'ignored' : status
  if (s === 'modified') return 'bg-yellow-500/20 text-yellow-400'
  if (s === 'added') return 'bg-green-500/20 text-green-400'
  if (s === 'deleted') return 'bg-red-500/20 text-red-400'
  if (s === 'untracked') return 'bg-blue-500/20 text-blue-400'
  return 'bg-gray-500/20 text-gray-400'
}

function isUntracked(status: string): boolean {
  return status === '??' || status === 'untracked'
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

// ── Churn Bar ────────────────────────────────────────────────────────────────

function ChurnBar({ added, removed, max }: { added: number; removed: number; max: number }) {
  if (max === 0) return null
  const addPct = Math.round((added / max) * 100)
  const remPct = Math.round((removed / max) * 100)
  return (
    <div className="flex h-1 w-full gap-px" title={`+${added} / -${removed}`}>
      <div className="rounded-sm bg-green-500/50" style={{ width: `${addPct}%` }} />
      <div className="rounded-sm bg-red-500/50" style={{ width: `${remPct}%` }} />
    </div>
  )
}

// ── Diff Viewer ──────────────────────────────────────────────────────────────

function DiffViewer() {
  const selectedPath = useStore($reviewSelectedPath)
  const diffLines = useStore($reviewDiffLines)
  const loading = useStore($reviewLoadingDiff)
  const error = useStore($reviewDiffError)

  const handleDismiss = useCallback(() => clearReviewSelection(), [])

  if (!selectedPath) return null

  const fileName = selectedPath.split(/[/\\]/).pop() ?? selectedPath

  return (
    <div className="border-t border-border/40">
      {/* Diff header */}
      <div className="flex items-center gap-2 border-b border-border/30 px-3 py-1.5">
        <Codicon name="diff" size={12} className="text-muted-foreground/60" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-mono text-foreground/70">{fileName}</span>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-border/50 transition-colors"
        >
          <Codicon name="close" size={12} />
        </button>
      </div>

      {/* Diff content */}
      <div className="max-h-48 overflow-y-auto bg-background/50">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Codicon name="loading" size={14} spinning className="text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="px-3 py-2 text-[11px] text-red-400">{error}</div>
        )}
        {!loading && !error && diffLines.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground/50 italic">No changes</div>
        )}
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`flex font-mono text-[11px] leading-5 ${
              line.type === 'added'
                ? 'bg-green-500/10 text-green-400'
                : line.type === 'removed'
                ? 'bg-red-500/10 text-red-400'
                : 'text-foreground/50'
            }`}
          >
            <span className="w-10 shrink-0 select-none text-right pr-2 text-foreground/25">
              {line.oldNum ?? ''}
            </span>
            <span className="w-10 shrink-0 select-none text-right pr-2 text-foreground/25">
              {line.newNum ?? ''}
            </span>
            <span className="w-4 shrink-0 select-none text-center text-foreground/30">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre overflow-hidden text-ellipsis">
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── File Tree Node ───────────────────────────────────────────────────────────

function FileTreeNode({
  node,
  depth,
  cwd,
  selectedPath,
  onFileClick,
  onStage,
  onUnstage,
  onDiscard,
  onRevertConfirm,
}: {
  node: ReviewTreeNode
  depth: number
  cwd: string
  selectedPath: string | null
  onFileClick: (path: string) => void
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onDiscard: (path: string) => void
  onRevertConfirm: (path: string) => void
}) {
  const collapsedDirs = useStore($reviewCollapsedDirs)
  const [hovering, setHovering] = useState(false)

  // Directory node
  if (node.isDir) {
    const collapsed = collapsedDirs.has(node.id)
    return (
      <div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-accent/10 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleReviewDir(node.id)}
        >
          <Codicon
            name={collapsed ? 'chevron-right' : 'chevron-down'}
            size={12}
            className="shrink-0 text-muted-foreground/60"
          />
          <Codicon
            name={collapsed ? 'folder' : 'folder-opened'}
            size={12}
            className="shrink-0 text-yellow-500/60"
          />
          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/70">{node.name}</span>
          {node.children && (
            <span className="text-[9px] text-muted-foreground/40">
              {node.children.length}
            </span>
          )}
        </div>
        {!collapsed && node.children?.map(child => (
          <FileTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            cwd={cwd}
            selectedPath={selectedPath}
            onFileClick={onFileClick}
            onStage={onStage}
            onUnstage={onUnstage}
            onDiscard={onDiscard}
            onRevertConfirm={onRevertConfirm}
          />
        ))}
      </div>
    )
  }

  // File node
  const file = node.file!
  const isSelected = selectedPath === file.path
  const fileName = node.name

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`group flex items-center gap-1.5 py-0.5 cursor-pointer transition-colors ${
            isSelected ? 'bg-accent/20' : 'hover:bg-accent/10'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={() => onFileClick(file.path)}
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', file.path)
            e.dataTransfer.effectAllowed = 'copy'
          }}
        >
          {/* Status badge */}
          <span className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold ${statusBadge(file.status)}`}>
            {file.status}
          </span>

          {/* File name */}
          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">{fileName}</span>

          {/* Hover actions */}
          {hovering && (
            <div className="shrink-0 flex items-center gap-0.5">
              {!file.staged ? (
                <Tip label="Stage">
                  <button
                    onClick={e => { e.stopPropagation(); onStage(file.path) }}
                    className="rounded p-0.5 text-green-400/70 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                  >
                    <Codicon name="add" size={11} />
                  </button>
                </Tip>
              ) : (
                <Tip label="Unstage">
                  <button
                    onClick={e => { e.stopPropagation(); onUnstage(file.path) }}
                    className="rounded p-0.5 text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  >
                    <Codicon name="discard" size={11} />
                  </button>
                </Tip>
              )}
              {!isUntracked(file.status) && (
                <Tip label="Revert changes">
                  <button
                    onClick={e => { e.stopPropagation(); onRevertConfirm(file.path) }}
                    className="rounded p-0.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Codicon name="history" size={11} />
                  </button>
                </Tip>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onFileClick(file.path)}>
          <Codicon name="diff" size={13} /> Open Changes
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openFileInEditor(file.path)}>
          <Codicon name="file" size={13} /> Open File
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openInExplorer(file.path)}>
          <Codicon name="folder-opened" size={13} /> Reveal in Explorer
        </ContextMenuItem>
        <ContextMenuItem onClick={() => copyPath(file.path)}>
          <Codicon name="copy" size={13} /> Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        {!file.staged ? (
          <ContextMenuItem onClick={() => onStage(file.path)}>
            <Codicon name="add" size={13} /> Stage File
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => onUnstage(file.path)}>
            <Codicon name="discard" size={13} /> Unstage File
          </ContextMenuItem>
        )}
        {!isUntracked(file.status) && (
          <ContextMenuItem variant="destructive" onClick={() => onRevertConfirm(file.path)}>
            <Codicon name="history" size={13} /> Discard Changes
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── IPC Helpers ──────────────────────────────────────────────────────────────

function openFileInEditor(filePath: string) {
  window.anakotDesktop?.openExternal?.(`file://${filePath.replace(/\\/g, '/')}`)
}

function openInExplorer(filePath: string) {
  const dir = filePath.replace(/[/\\][^/\\]+$/, '').replace(/\\/g, '/')
  window.anakotDesktop?.openExternal?.(`file://${dir}`)
}

function copyPath(filePath: string) {
  window.anakotDesktop?.writeClipboard?.(filePath)
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function GitCommitPanel() {
  const state = useStore($gitCommitState)
  const viewMode = useStore($reviewViewMode)
  const selectedPath = useStore($reviewSelectedPath)
  const { repoPath, branch, files, message, suggestions, loading, generating, committing, error, commitResult } = state

  const commitModelRef = useRef<string | null>(null)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [revertTarget, setRevertTarget] = useState<string | null>(null)

  // Load auxiliary model for commit generation
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { getAuxiliaryModels } = await import('@/anakot')
        const aux = await getAuxiliaryModels()
        if (!cancelled && aux?.tasks) {
          const task = aux.tasks.find((t: { task: string; provider: string | null; model: string | null }) => t.task === 'commit_gen')
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

  // ── File operations ──────────────────────────────────────────────────────

  const handleFileClick = useCallback((path: string) => {
    selectReviewFile(path, repoPath)
  }, [repoPath])

  const handleStage = useCallback(async (path: string) => {
    const result = await window.anakotDesktop.gitAdd?.(repoPath, [path])
    if (result?.ok) {
      const status = await window.anakotDesktop.gitStatus?.(repoPath)
      if (status) setGitStatus(status)
    }
  }, [repoPath])

  const handleUnstage = useCallback(async (path: string) => {
    const result = await window.anakotDesktop.gitUnstage?.(repoPath, [path])
    if (result?.ok) {
      const status = await window.anakotDesktop.gitStatus?.(repoPath)
      if (status) setGitStatus(status)
    }
  }, [repoPath])

  const handleDiscard = useCallback(async (path: string) => {
    const result = await window.anakotDesktop.gitDiscard?.(repoPath, [path])
    if (result?.ok) {
      if (selectedPath === path) clearReviewSelection()
      const status = await window.anakotDesktop.gitStatus?.(repoPath)
      if (status) setGitStatus(status)
    }
  }, [repoPath, selectedPath])

  const handleRevertConfirm = useCallback((path: string) => {
    setRevertTarget(path)
  }, [])

  const handleRevertExecute = useCallback(async () => {
    if (!revertTarget) return
    await handleDiscard(revertTarget)
    setRevertTarget(null)
  }, [revertTarget, handleDiscard])

  // ── Commit operations ───────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    let { diff, files: statusFiles, repoPath: path } = $gitCommitState.get()
    if (!diff && path) {
      const diffResult = await window.anakotDesktop.gitStagedDiff?.(path)
      if (diffResult?.ok && diffResult.diff) {
        diff = diffResult.diff
        setGitDiff(diff)
        const status = await window.anakotDesktop.gitStatus?.(path)
        if (status) {
          statusFiles = status.files ?? []
          setGitStatus(status)
        }
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
              content: 'You are a git commit message generator. Generate 3-5 concise conventional commit messages (format: type(scope): description) based on the provided git diff. Return them as a JSON array. Each object: {"type":"feat|fix|chore|refactor|docs|test|style","scope":"optional","message":"subject","body":"optional description"}. Return ONLY valid JSON.',
            },
            {
              role: 'user',
              content: `Generate 3-5 conventional commit messages for this diff.\n\nFiles changed:\n${statusFiles.map(f => `[${f.status}] ${f.path}`).join('\n')}\n\nDiff:\n\`\`\`diff\n${diff.slice(0, 6000)}\n\`\`\``,
            },
          ],
          max_tokens: 2048,
          temperature: 0.3,
          reasoning_effort: 'low',
        },
        timeoutMs: 30000,
      })

      const content = response?.choices?.[0]?.message?.content
      if (content) {
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as Array<{ type: string; scope?: string; message: string; body?: string }>
            if (Array.isArray(parsed) && parsed.length) {
              setGitSuggestions(parsed.map(s => ({
                type: s.type as 'feat' | 'fix' | 'chore' | 'refactor' | 'docs' | 'test' | 'style',
                scope: s.scope,
                message: s.message,
                body: s.body,
              })))
              setGitMessage(formatCommit(parsed[0]))
              return
            }
          } catch { /* parse error */ }
        }
      }
      setGitError('Could not parse AI response. Try again.')
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleSuggestionClick = useCallback((s: { type: string; scope?: string; message: string }) => {
    setGitMessage(formatCommit(s))
  }, [])

  const handleCommit = useCallback(async () => {
    const { message: msg, repoPath: path } = $gitCommitState.get()
    if (!msg.trim() || !path) return
    setGitCommitting(true)
    try {
      const result = await window.anakotDesktop.gitCommit?.(path, msg.trim())
      if (result?.ok) {
        setGitCommitResult(`✓ Committed: ${msg.split('\n')[0].slice(0, 60)}`)
        setGitSuggestions([])
        setGitDiff('')
        clearReviewSelection()
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
    const { message: msg, repoPath: path } = $gitCommitState.get()
    if (!msg.trim() || !path) return
    setGitCommitting(true)
    try {
      const commitResult = await window.anakotDesktop.gitCommit?.(path, msg.trim())
      if (!commitResult?.ok) {
        setGitError(commitResult?.error || 'Commit failed')
        return
      }
      const pushResult = await window.anakotDesktop.gitPush?.(path)
      if (pushResult?.ok) {
        setGitCommitResult(`✓ Synced: ${msg.split('\n')[0].slice(0, 60)}`)
      } else {
        setGitCommitResult(`✓ Committed (push: ${pushResult?.error || 'failed'})`)
      }
      setGitSuggestions([])
      setGitDiff('')
      clearReviewSelection()
      const status = await window.anakotDesktop.gitStatus?.(path)
      if (status) setGitStatus(status)
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleCommitAmend = useCallback(async () => {
    const { message: msg, repoPath: path } = $gitCommitState.get()
    if (!path) return
    setGitCommitting(true)
    try {
      const result = await window.anakotDesktop.gitCommitAmend?.(path, msg.trim())
      if (result?.ok) {
        setGitCommitResult(`✓ Amended: ${(msg || '(no message change)').split('\n')[0].slice(0, 60)}`)
        setGitSuggestions([])
        setGitDiff('')
        clearReviewSelection()
        const status = await window.anakotDesktop.gitStatus?.(path)
        if (status) setGitStatus(status)
      } else {
        setGitError(result?.error || 'Amend failed')
      }
    } catch (e) {
      setGitError(String(e))
    }
  }, [])

  const handleCreateBranchAndCommit = useCallback(async () => {
    const name = branchName.trim()
    if (!name) return
    const { message: msg, repoPath: path } = $gitCommitState.get()
    if (!msg.trim() || !path) return
    setShowBranchDialog(false)
    setGitCommitting(true)
    try {
      const checkoutResult = await window.anakotDesktop.gitCheckoutNewBranch?.(path, name)
      if (!checkoutResult?.ok) {
        setGitError(checkoutResult?.error || 'Branch creation failed')
        return
      }
      const commitResult = await window.anakotDesktop.gitCommit?.(path, msg.trim())
      if (commitResult?.ok) {
        setGitCommitResult(`✓ Created branch "${name}" and committed`)
      } else {
        setGitError(commitResult?.error || 'Commit failed')
      }
      setGitSuggestions([])
      setGitDiff('')
      setBranchName('')
      clearReviewSelection()
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
      clearReviewSelection()
    }
  }, [])

  const handleViewModeToggle = useCallback(() => {
    setReviewViewMode(viewMode === 'tree' ? 'flat' : 'tree')
  }, [viewMode])

  // ── Build file tree ─────────────────────────────────────────────────────

  const treeData = viewMode === 'tree'
    ? buildReviewTree(files)
    : buildReviewFlatList(files)
  const stagedCount = files.filter(f => f.staged).length
  const unstagedCount = files.filter(f => !f.staged).length
  const canCommit = !committing && message.trim().length > 0 && stagedCount > 0

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[10px] font-bold font-mono tracking-[0.15em] text-foreground/60">COMMIT</span>
        {branch && (
          <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground/60">
            {branch}
          </span>
        )}
        <button
          onClick={() => { clearGitCommitData(); clearReviewSelection() }}
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

        {/* Loading */}
        {repoPath && loading && (
          <div className="flex items-center justify-center p-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-3 mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Success */}
        {commitResult && (
          <div className="mx-3 mt-2 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
            {commitResult}
          </div>
        )}

        {repoPath && !loading && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30">
              <Tip label={viewMode === 'tree' ? 'Switch to flat list' : 'Switch to tree view'}>
                <button
                  onClick={handleViewModeToggle}
                  className="rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent/20 transition-colors"
                >
                  <Codicon name={viewMode === 'tree' ? 'list-flat' : 'list-tree'} size={12} />
                </button>
              </Tip>
              <span className="text-[10px] text-muted-foreground/50">
                {stagedCount} staged · {unstagedCount} unstaged
              </span>
            </div>

            {/* File tree */}
            <div className="px-1 py-1">
              {files.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-muted-foreground/40 italic">
                  No changes
                </div>
              ) : (
                treeData.map(node => (
                  <FileTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    cwd={repoPath}
                    selectedPath={selectedPath}
                    onFileClick={handleFileClick}
                    onStage={handleStage}
                    onUnstage={handleUnstage}
                    onDiscard={handleDiscard}
                    onRevertConfirm={handleRevertConfirm}
                  />
                ))
              )}
            </div>

            {/* Diff preview */}
            <DiffViewer />

            <div className="border-t border-border/30" />

            {/* Generate button + suggestions */}
            <div className="px-3 py-2 space-y-2">
              <button
                onClick={handleGenerate}
                disabled={generating || stagedCount === 0}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </span>
                ) : 'Generate Message'}
              </button>

              {suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground/70">Suggestions</p>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full text-left rounded border border-border/30 px-2.5 py-1.5 text-xs hover:bg-accent/10 transition-colors"
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

            {/* Commit message + buttons */}
            <div className="px-3 py-2 space-y-2">
              <textarea
                value={message}
                onChange={e => setGitMessage(e.target.value)}
                placeholder="Commit message..."
                rows={4}
                className="w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none resize-none focus:border-accent font-mono"
              />

              {/* Split button — VS Code style */}
              <div className="flex items-stretch">
                <button
                  onClick={handleCommit}
                  disabled={!canCommit}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-l bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {committing ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Working...
                    </span>
                  ) : (
                    <>
                      <Codicon name="check" size={12} />
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
                      <Codicon name="chevron-down" size={10} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
                    <DropdownMenuItem onClick={handleCommit}>
                      <Codicon name="check" size={13} /> Commit
                      <span className="ml-auto text-[10px] text-muted-foreground/50">Ctrl+Enter</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCommitSync}>
                      <Codicon name="repo-push" size={13} /> Commit + Push
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCommitAmend}>
                      <Codicon name="edit" size={13} /> Amend Commit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowBranchDialog(true)}>
                      <Codicon name="git-branch" size={13} /> New Branch + Commit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Branch dialog — PromptDialog owns the input + submit */}
      <PromptDialog
        open={showBranchDialog}
        onClose={() => setShowBranchDialog(false)}
        onConfirm={name => {
          setBranchName(name)
          // Let React flush the branchName before the handler reads it
          setTimeout(() => handleCreateBranchAndCommit(), 0)
        }}
        title="Create branch and commit"
        description="Enter a name for the new branch."
        placeholder="feature/my-branch"
        confirmLabel="Create & Commit"
        busyLabel="Creating..."
        cancelLabel="Cancel"
      />

      {/* Revert confirm dialog */}
      <ConfirmDialog
        open={revertTarget !== null}
        onClose={() => setRevertTarget(null)}
        onConfirm={handleRevertExecute}
        title="Discard changes?"
        description={`This will permanently discard all uncommitted changes in:\n${revertTarget ?? ''}`}
        confirmLabel="Discard"
        busyLabel="Discarding..."
        doneLabel="Discarded"
        destructive
      />
    </div>
  )
}
