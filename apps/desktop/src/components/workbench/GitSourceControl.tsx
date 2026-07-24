import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { $currentCwd } from '@/store/session'
import { setCurrentSessionPreviewTarget } from '@/store/preview'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { setBottomPanelTab, setBottomPanelOpen } from '@/store/workbench'
import {
  $gitStatus, $gitLoading, $gitCommitMessage, $gitError, $gitBranches,
  changeWorkspace, triggerGitRefresh, gitStageFile, gitStageAllFiles, gitUnstageFile, gitDiscardChanges, gitCommit,
  gitPush, gitCommitAmend, gitCheckoutNewBranch,
  gitLoadBranches, gitCheckoutBranch, type GitFile
} from '@/store/git'

interface ContextMenuState {
  x: number
  y: number
  file: GitFile
  type: 'staged' | 'changes'
}

const STATUS_LETTER: Record<string, { letter: string; color: string }> = {
  modified:    { letter: 'M', color: 'text-amber-400' },
  added:       { letter: 'A', color: 'text-green-400' },
  deleted:     { letter: 'D', color: 'text-red-400' },
  renamed:     { letter: 'R', color: 'text-blue-400' },
  untracked:   { letter: '?', color: 'text-muted-foreground' },
  unmerged:    { letter: 'U', color: 'text-red-400' },
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return 'file'
  if (ext === 'ts' || ext === 'tsx') return 'symbol-file'
  if (ext === 'py' || ext === 'rb' || ext === 'go' || ext === 'rs') return 'symbol-misc'
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'symbol-color'
  const CODE_EXTS = ['ts','tsx','js','jsx','cjs','mjs','rb','go','rs','java','kt','scala','swift','html','htm','vue','svelte','json','yaml','yml','xml','toml','sh','bash','zsh','ps1','bat','sql','graphql']
  if (CODE_EXTS.includes(ext)) return 'file-code'
  return 'file'
}

export function GitSourceControl() {
  const { t: translations } = useI18n()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = translations as any
  const cwd = useStore($currentCwd)
  const status = useStore($gitStatus)
  const branches = useStore($gitBranches)
  const error = useStore($gitError)
  const loading = useStore($gitLoading)
  const commitMessage = useStore($gitCommitMessage)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [checkoutConflict, setCheckoutConflict] = useState<{ branch: string, message: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [stagedCollapsed, setStagedCollapsed] = useState(false)
  const [changesCollapsed, setChangesCollapsed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track the current git root in a ref so async callbacks always see the latest value
  const gitRootRef = useRef<string | null>(null)
  useEffect(() => {
    gitRootRef.current = status.root
  }, [status.root])

  useEffect(() => {
    if (cwd.trim()) {
      changeWorkspace(cwd)
      // Subscribe to .git/ file-watcher events (primary mechanism)
      void window.anakotDesktop?.gitSubscribe?.(cwd)
      const unsubscribeGit = window.anakotDesktop?.onGitChanged?.((data: { root: string }) => {
        // Compare against the ref — always reads the latest resolved root
        if (data.root && gitRootRef.current && data.root.toLowerCase() === gitRootRef.current.toLowerCase()) {
          void triggerGitRefresh()
        }
      })
      // Also listen for file-write events from the main process (e.g. editor saves via IPC)
      const unsubscribeFile = window.anakotDesktop?.onFileChanged?.((data: { path: string; root: string }) => {
        if (data.root && gitRootRef.current && data.root.toLowerCase() === gitRootRef.current.toLowerCase()) {
          void triggerGitRefresh()
        }
      })
      return () => {
        unsubscribeGit?.()
        unsubscribeFile?.()
        void window.anakotDesktop?.gitUnsubscribe?.(cwd)
      }
    }
  }, [cwd])

  // Refresh when the panel becomes visible (sidebar tab switch)
  const handleFocus = useCallback(() => {
    if (cwd.trim()) {
      void triggerGitRefresh(cwd)
    }
  }, [cwd])

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && cwd.trim()) {
        void triggerGitRefresh(cwd)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [cwd])

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [contextMenu])

  const stagedFiles = useMemo(() => status.files.filter(f => f.staged), [status.files])
  const unstagedFiles = useMemo(() => status.files.filter(f => !f.staged), [status.files])

  const handleStage = useCallback(async (file: string) => {
    
    setContextMenu(null)
    const root = status.root || cwd
    
    await gitStageFile(root, file)
  }, [cwd, status.root])

  const handleUnstage = useCallback(async (file: string) => {
    
    setContextMenu(null)
    const root = status.root || cwd
    
    try {
      await gitUnstageFile(root, file)
    } catch (e) {
      console.error('[GitSourceControl] gitUnstageFile error:', e)
    }
  }, [cwd, status.root])

  const handleDiscard = useCallback(async (file: string) => {
    setContextMenu(null)
    const root = status.root || cwd
    if (window.confirm(`Discard changes to "${file}"?`)) {
      await gitDiscardChanges(root, file)
    }
  }, [cwd, status.root])

  const handleStageAll = useCallback(async () => {
    
    setContextMenu(null)
    const root = status.root || cwd
    const files = unstagedFiles.map(f => f.path)
    if (files.length > 0) {
      const result = await gitStageAllFiles(root, files)
      
    }
  }, [cwd, status.root, unstagedFiles])

  const generatingRef = useRef(false)

  const handleGenerate = useCallback(async () => {
    if (!cwd.trim()) {
      return
    }
    if (generatingRef.current) {
      return
    }
    setGenerating(true)
    generatingRef.current = true
    try {
      const root = status.root || cwd
      const { gitGenerateCommitMessage, $gitCommitMessage } = await import('@/store/git')
      const message = await gitGenerateCommitMessage(root)
      if (message) {
        $gitCommitMessage.set(message)
        const el = textareaRef.current
        if (el) {
          el.value = message
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        } else {
        }
      } else {
      }
    } catch (err) {
      console.error('[Sparkle] 💥 Unhandled error in handleGenerate:', err)
    } finally {
      generatingRef.current = false
      setGenerating(false)
    }
  }, [cwd, status.root])

  const handleCommit = useCallback(async () => {
    if (commitMessage.trim()) {
      const root = status.root || cwd
      await gitCommit(root, commitMessage)
    }
  }, [cwd, status.root, commitMessage])

  const handleCommitAndPush = useCallback(async () => {
    if (!commitMessage.trim()) return
    const root = status.root || cwd
    const commitResult = await gitCommit(root, commitMessage)
    if (commitResult?.ok) {
      await gitPush(root)
    }
  }, [cwd, status.root, commitMessage])

  const handleCommitAmend = useCallback(async () => {
    if (!commitMessage.trim()) return
    const root = status.root || cwd
    await gitCommitAmend(root, commitMessage)
  }, [cwd, status.root, commitMessage])

  const [newBranchDialog, setNewBranchDialog] = useState<{ cwd: string } | null>(null)
  const [newBranchName, setNewBranchName] = useState('')
  const handleCreateNewBranch = useCallback(async () => {
    if (!newBranchDialog || !newBranchName.trim()) return
    const result = await gitCheckoutNewBranch(newBranchDialog.cwd, newBranchName.trim())
    if (result.ok) {
      setNewBranchDialog(null)
      setNewBranchName('')
    }
  }, [newBranchDialog, newBranchName])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void handleCommit()
    }
  }, [handleCommit])

  const openContextMenu = useCallback((e: React.MouseEvent, file: GitFile, type: 'staged' | 'changes') => {
    e.preventDefault()
    e.stopPropagation()
    const MENU_WIDTH = 200
    const MENU_HEIGHT = 160
    const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH)
    const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT)
    setContextMenu({ x, y, file, type })
  }, [])

  const handleOpenFile = useCallback(async (file: string) => {
    setContextMenu(null)
    const root = status.root || cwd
    const absolutePath = file.startsWith('/') ? file : `${root}/${file}`.replace(/\\/g, '/').replace(/\/+/g, '/')
    try {
      const preview = await normalizeOrLocalPreviewTarget(absolutePath, root)
      if (preview) {
        setCurrentSessionPreviewTarget(preview, 'file-browser', absolutePath)
      }
    } catch {
      // Fallback to external if preview fails
      void window.anakotDesktop?.openExternal?.(`file://${absolutePath}`)
    }
  }, [cwd, status.root])

  const handleCopyPath = useCallback((file: string) => {
    setContextMenu(null)
    navigator.clipboard.writeText(file).catch(() => undefined)
  }, [])

  const handleRevealInExplorer = useCallback((file: string) => {
    setContextMenu(null)
    const root = status.root || cwd
    const absolutePath = file.startsWith('/') ? file : `${root}/${file}`.replace(/\\/g, '/').replace(/\/+/g, '/')
    const parentDir = absolutePath.split('/').slice(0, -1).join('/') || '/'
    void window.anakotDesktop?.openExternal?.(`file://${parentDir}`)
  }, [cwd, status.root])

  const renderFileItem = (file: GitFile, type: 'staged' | 'changes') => {
    const statusInfo = STATUS_LETTER[file.status] || STATUS_LETTER.modified
    const fileName = file.path.split('/').pop() || file.path
    const fileDir = file.path.split('/').slice(0, -1).join('/')
    const iconName = getFileIcon(fileName)
    return (
      <div
        key={file.path}
        className="group flex items-start gap-1.5 rounded-[2px] px-2 py-[3px] text-xs leading-4 hover:bg-(--ui-control-hover-background) w-full cursor-pointer"
        onContextMenu={e => openContextMenu(e, file, type)}
        onClick={() => {
          
          void handleOpenFile(file.path)
        }}
      >
        {/* File type icon (left side) */}
        <Codicon name={iconName} size="0.65rem" className="shrink-0 mt-0.5 text-muted-foreground" />
        {/* Filename + path (middle) */}
        <div className="flex-1 min-w-0">
          <div className="truncate text-foreground text-[0.6rem]" title={file.path}>{fileName}</div>
          {fileDir && (
            <div className="truncate text-[0.5rem] leading-3 text-muted-foreground/45">{fileDir}</div>
          )}
        </div>
        {/* Status letter on the right (VS Code style) */}
        <span className={`shrink-0 text-[0.5rem] font-bold font-mono leading-4 mt-0.5 ${statusInfo.color}`}>
          {statusInfo.letter}
        </span>
        {/* Hover actions — minimal icon buttons */}
        <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 mt-0.5 shrink-0">
          {type === 'staged' && (
             <button
               className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
               onClick={e => { e.stopPropagation(); e.preventDefault();  handleUnstage(file.path) }}
               title="Unstage"
               type="button"
             >
               <Codicon name="remove" size="0.5rem" />
             </button>
          )}
          {type === 'changes' && (
            <>
              <button
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
                onClick={e => { e.stopPropagation(); e.preventDefault();  handleStage(file.path) }}
                title="Stage"
                type="button"
              >
                <Codicon name="add" size="0.5rem" />
              </button>
              <button
                className="rounded-sm p-0.5 text-muted-foreground hover:text-destructive focus:outline-none"
                onClick={e => { e.stopPropagation(); e.preventDefault();  handleDiscard(file.path) }}
                title="Discard"
                type="button"
              >
                <Codicon name="discard" size="0.5rem" />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div tabIndex={-1} className="flex h-full min-w-0 min-h-0 flex-col gap-2 p-2 outline-none" onFocus={handleFocus}>
      <style>{`.commit-textarea::placeholder { white-space: nowrap; text-overflow: ellipsis; }`}</style>
      {/* Header */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Codicon name="source-control" size="0.875rem" className="shrink-0 text-foreground" />
        <span className="min-w-0 truncate text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
          {t.gitSourceControl || 'Source Control'}
        </span>
        {status.branch && (
          <DropdownMenu onOpenChange={(open) => {
            if (open && cwd.trim()) void gitLoadBranches(cwd)
          }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto flex shrink-0 items-center gap-1 rounded-[2px] border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-1.5 py-0.5 hover:bg-(--ui-control-hover-background)"
              >
                <Codicon name="git-branch" size="0.625rem" className="text-foreground" />
                <span className="max-w-20 truncate text-[0.65rem] font-medium text-foreground">{status.branch}</span>
                <Codicon name="chevron-down" size="0.625rem" className="text-muted-foreground ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[200px] overflow-y-auto">
              {branches.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading branches...</div>
              ) : (
                branches.map((b) => (
                  <DropdownMenuItem
                    key={b.name}
                    className="flex items-center gap-2 text-xs"
                    onClick={async () => {
                      if (!b.current && cwd.trim()) {
                        const res = await gitCheckoutBranch(cwd, b.name)
                        if (!res.ok && res.error && (res.error.toLowerCase().includes('overwrite') || res.error.toLowerCase().includes('commit') || res.error.toLowerCase().includes('stash'))) {
                          setCheckoutConflict({ branch: b.name, message: res.error })
                          $gitError.set(null)
                        }
                      }
                    }}
                  >
                    <Codicon name={b.current ? 'check' : 'blank'} size="0.75rem" className={b.current ? 'text-foreground' : 'invisible'} />
                    <span className="truncate max-w-48">{b.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Commit input - sparkle button next to textarea */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-1">
          <textarea
            ref={textareaRef}
            className="commit-textarea min-h-[22px] flex-1 rounded-[2px] border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) pl-3 py-[5px] text-[0.65rem] leading-4 text-foreground placeholder:text-muted-foreground/45 focus:border-primary focus:outline-none resize-none overflow-hidden"
            placeholder={`Message (Ctrl+Enter to commit on "${status.branch || 'main'}")`}
            value={commitMessage}
            onChange={e => {
              $gitCommitMessage.set(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            aria-label="Generate commit message with AI"
            className="flex h-[28px] shrink-0 items-center justify-center rounded-[2px] px-1 text-muted-foreground hover:text-foreground hover:bg-(--ui-control-hover-background) disabled:opacity-40"
            disabled={generating}
            onClick={handleGenerate}
            type="button"
            title="Generate commit message from changes"
          >
            <Codicon name={generating ? 'sync' : 'sparkle'} size="0.7rem" className={generating ? 'animate-spin' : ''} />
          </button>
        </div>
        {/* Split-button commit — VS Code style */}
        <div className="flex items-stretch">
          <button
            className="flex flex-1 items-center justify-center gap-1.5 rounded-s-[2px] border border-(--ui-stroke-tertiary) bg-[#3c3c4c] px-3 py-[5px] text-[0.65rem] font-medium text-foreground hover:bg-[#4a4a5a] disabled:opacity-40 disabled:pointer-events-none"
            disabled={!commitMessage.trim() || stagedFiles.length === 0}
            onClick={handleCommit}
            type="button"
          >
            <Codicon name="check" size="0.65rem" className="text-foreground" />
            <span>{t.gitCommit || 'Commit'}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center rounded-r-[2px] border border-l-0 border-(--ui-stroke-tertiary) bg-[#3c3c4c] px-[7px] py-[5px] text-muted-foreground hover:bg-[#4a4a5a] disabled:opacity-40"
                disabled={!commitMessage.trim() || stagedFiles.length === 0}
                type="button"
                aria-label="Commit options"
              >
                <Codicon name="chevron-down" size="0.65rem" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="data-[state=open]:animate-none">
              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={handleCommit}>
                <Codicon name="check" size="0.65rem" />
                <span>Commit</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={handleCommitAndPush}>
                <Codicon name="cloud-upload" size="0.65rem" />
                <span>Commit & Push</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={handleCommitAmend}>
                <Codicon name="edit" size="0.65rem" />
                <span>Commit (Amend)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 text-xs"
                onClick={() => {
                  const root = status.root || cwd
                  if (root) setNewBranchDialog({ cwd: root })
                }}
              >
                <Codicon name="git-branch" size="0.65rem" />
                <span>Create New Branch...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Separator — like VS Code's visual boundary between commit box and file list */}
      <div className="h-px bg-(--ui-stroke-tertiary)" />

      {/* Git error banner — shows git-specific errors like VS Code */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[0.65rem] text-amber-300">
          <Codicon name="warning" size="0.75rem" className="mt-px shrink-0" />
          <div className="flex-1">
            <div className="break-all font-medium">{error}</div>
            <button
              className="mt-0.5 flex items-center gap-1 text-[0.6rem] text-amber-400/70 hover:text-amber-300"
              onClick={() => {
                setBottomPanelTab('output')
                setBottomPanelOpen(true)
              }}
              type="button"
            >
              <Codicon name="link-external" size="0.55rem" />
              View details in Output panel
            </button>
          </div>
          <button
            className="shrink-0 rounded-sm px-1 text-amber-400 hover:bg-amber-500/20"
            onClick={() => $gitError.set(null)}
            type="button"
            title="Dismiss"
          >
            <Codicon name="close" size="0.625rem" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Codicon name="loading" size="0.75rem" className="animate-spin" />
          {t.gitLoadingGit || 'Loading git status...'}
        </div>
      )}

      {/* No repo */}
      {!loading && !status.root && cwd.trim() && (
        <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
          <Codicon name="folder-opened" size="1.5rem" className="text-muted-foreground/40" />
          <span className="text-[0.65rem] text-muted-foreground/50">
            {status.error === 'network-path' ? 'Network paths not supported for git' : status.error === 'no-git-root' ? 'No git repository found in this folder' : t.gitNotAGitRepo || 'Not a git repository'}
          </span>
        </div>
      )}

      {/* No changes */}
      {!loading && status.root && status.files.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
          <Codicon name="check-all" size="1.5rem" className="text-green-400/60" />
          <span className="text-[0.65rem] text-muted-foreground/50">
            {t.gitNoChanges || 'No changes'}
          </span>
        </div>
      )}

      {/* File lists */}
      {status.root && status.files.length > 0 && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Staged Changes */}
          {stagedFiles.length > 0 && (
            <div>
              <div
                className="flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-(--ui-control-hover-background) rounded-[2px] select-none"
                onClick={() => setStagedCollapsed(prev => !prev)}
              >
                <Codicon name={stagedCollapsed ? 'chevron-right' : 'chevron-down'} size="0.5rem" className="text-muted-foreground shrink-0" />
                <span className="text-[0.55rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {t.gitStaged || 'Staged Changes'}
                </span>
                <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-(--ui-bg-quaternary) px-[5px] text-[0.45rem] font-semibold text-muted-foreground/70">
                  {stagedFiles.length}
                </span>
              </div>
              {!stagedCollapsed && (
                <div className="flex flex-col gap-px">
                  {stagedFiles.map(f => renderFileItem(f, 'staged'))}
                </div>
              )}
            </div>
          )}
          {/* Changes (unstaged) — always show like VS Code */}
          <div>
            <div
              className="flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-(--ui-control-hover-background) rounded-[2px] select-none"
              onClick={() => setChangesCollapsed(prev => !prev)}
            >
              <Codicon name={changesCollapsed ? 'chevron-right' : 'chevron-down'} size="0.5rem" className="text-muted-foreground shrink-0" />
              <span className="text-[0.55rem] font-medium uppercase tracking-wider text-muted-foreground">
                {t.gitChanges || 'Changes'}
              </span>
              <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-(--ui-bg-quaternary) px-[5px] text-[0.45rem] font-semibold text-muted-foreground/70">
                {unstagedFiles.length}
              </span>
              {unstagedFiles.length > 0 && (
                <button
                  className="ml-auto rounded-[2px] px-1 text-[0.5rem] text-muted-foreground/60 hover:text-foreground hover:bg-(--ui-control-hover-background)"
                  onClick={e => { e.stopPropagation(); handleStageAll() }}
                  type="button"
                  title="Stage All"
                >
                  <Codicon name="add" size="0.5rem" />
                </button>
              )}
            </div>
            {!changesCollapsed && unstagedFiles.length > 0 && (
              <div className="flex flex-col gap-px">
                {unstagedFiles.map(f => renderFileItem(f, 'changes'))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null) }} />
          <div
            className="fixed z-[9999] min-w-[180px] rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) py-1 shadow-xl"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
            onContextMenu={e => e.preventDefault()}
          >
            {/* Stage / Unstage */}
            {contextMenu.type === 'staged' && (
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                onClick={() => handleUnstage(contextMenu.file.path)}
                type="button"
              >
                <Codicon name="remove" size="0.75rem" />
                Unstage Changes
              </button>
            )}
            {contextMenu.type === 'changes' && (
              <>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                  onClick={() => {  handleStage(contextMenu.file.path) }}
                  type="button"
                >
                  <Codicon name="add" size="0.75rem" />
                  Stage Changes
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-(--ui-control-hover-background)"
                  onClick={() => handleDiscard(contextMenu.file.path)}
                  type="button"
                >
                  <Codicon name="discard" size="0.75rem" />
                  Discard Changes
                </button>
              </>
            )}
            <div className="mx-3 my-1 h-px bg-(--ui-stroke-tertiary)" />
            {/* Open File */}
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
              onClick={() => handleOpenFile(contextMenu.file.path)}
              type="button"
            >
              <Codicon name="go-to-file" size="0.75rem" />
              Open File
            </button>
            <div className="mx-3 my-1 h-px bg-(--ui-stroke-tertiary)" />
            {/* Copy Path */}
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
              onClick={() => handleCopyPath(contextMenu.file.path)}
              type="button"
            >
              <Codicon name="copy" size="0.75rem" />
              Copy Path
            </button>
            {/* Reveal in Explorer */}
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
              onClick={() => handleRevealInExplorer(contextMenu.file.path)}
              type="button"
            >
              <Codicon name="folder-opened" size="0.75rem" />
              Reveal in Explorer
            </button>
          </div>
        </>
      )}
            {/* Checkout Conflict Dialog */}
      <Dialog open={!!checkoutConflict} onOpenChange={(open) => !open && setCheckoutConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checkout Failed</DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-sm text-foreground">
              <p>
                Cannot switch to <strong>{checkoutConflict?.branch}</strong> because you have uncommitted changes that would be overwritten.
              </p>
              <p>
                Please stash or commit your changes before switching branches to protect your data.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setCheckoutConflict(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create New Branch Dialog */}
      <Dialog open={!!newBranchDialog} onOpenChange={(open) => {
        if (!open) { setNewBranchDialog(null); setNewBranchName('') }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Enter a name for the new branch. It will be created from the current HEAD.
              </p>
              <input
                autoFocus
                className="w-full rounded-[2px] border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-2.5 py-1.5 text-[0.8rem] text-foreground placeholder:text-muted-foreground/45 focus:border-primary focus:outline-none"
                placeholder="branch-name"
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleCreateNewBranch() }
                  if (e.key === 'Escape') { setNewBranchDialog(null); setNewBranchName('') }
                }}
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewBranchDialog(null); setNewBranchName('') }}>
              Cancel
            </Button>
            <Button disabled={!newBranchName.trim()} onClick={handleCreateNewBranch}>
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}