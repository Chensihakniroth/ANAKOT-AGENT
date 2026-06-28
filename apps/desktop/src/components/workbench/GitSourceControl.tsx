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
  gitLoadBranches, gitCheckoutBranch, type GitFile
} from '@/store/git'

interface ContextMenuState {
  x: number
  y: number
  file: GitFile
  type: 'staged' | 'changes'
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  modified: { icon: 'edit', color: 'text-amber-400' },
  added: { icon: 'add', color: 'text-green-400' },
  deleted: { icon: 'trash', color: 'text-red-400' },
  renamed: { icon: 'file-symlink-file', color: 'text-blue-400' },
  untracked: { icon: 'question', color: 'text-muted-foreground' },
  unmerged: { icon: 'git-merge', color: 'text-red-400' },
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
    console.log('[GitSourceControl] handleStage clicked, file:', file, 'cwd:', cwd, 'status.root:', status.root)
    setContextMenu(null)
    const root = status.root || cwd
    console.log('[GitSourceControl] gitStageFile call:', root, file)
    await gitStageFile(root, file)
  }, [cwd, status.root])

  const handleUnstage = useCallback(async (file: string) => {
    console.log('[GitSourceControl] handleUnstage clicked, file:', file, 'cwd:', cwd, 'status.root:', status.root)
    setContextMenu(null)
    const root = status.root || cwd
    console.log('[GitSourceControl] gitUnstageFile call:', root, file)
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
    console.log('[GitSourceControl] Stage All clicked, unstagedFiles:', unstagedFiles.length)
    setContextMenu(null)
    const root = status.root || cwd
    const files = unstagedFiles.map(f => f.path)
    if (files.length > 0) {
      const result = await gitStageAllFiles(root, files)
      console.log('[GitSourceControl] Stage All result:', result)
    }
  }, [cwd, status.root, unstagedFiles])

  const handleCommit = useCallback(async () => {
    if (commitMessage.trim()) {
      const root = status.root || cwd
      await gitCommit(root, commitMessage)
    }
  }, [cwd, status.root, commitMessage])

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
    const statusInfo = STATUS_ICONS[file.status] || STATUS_ICONS.modified
    return (
      <div
        key={file.path}
        className="group flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-(--ui-control-hover-background) w-full cursor-pointer"
        onContextMenu={e => openContextMenu(e, file, type)}
        onClick={() => {
          console.log('[GitSourceControl] row click:', file.path, type)
          void handleOpenFile(file.path)
        }}
      >
        <Codicon name={statusInfo.icon} size="0.75rem" className={`shrink-0 ${statusInfo.color} w-4`} />
        <span className="flex-1 truncate text-foreground min-w-0" title={file.path}>{file.path.split('/').pop()}</span>
        <span className="text-[0.6rem] uppercase text-muted-foreground shrink-0">{file.status}</span>
        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 pr-1">
          {type === 'staged' && (
             <button
               className="rounded-sm p-1 text-muted-foreground hover:text-foreground focus:outline-none"
               onClick={e => { e.stopPropagation(); e.preventDefault(); console.log('[GitSourceControl] inline unstage click, file:', file.path); handleUnstage(file.path) }}
               title="Unstage"
               type="button"
             >
               <Codicon name="remove" size="0.625rem" />
             </button>
           )}
          {type === 'changes' && (
            <>
              <button
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground focus:outline-none"
                onClick={e => { e.stopPropagation(); e.preventDefault(); console.log('[GitSourceControl] inline stage click, file:', file.path); handleStage(file.path) }}
                title="Stage"
                type="button"
              >
                <Codicon name="add" size="0.625rem" />
              </button>
              <button
                className="rounded-sm p-1 text-muted-foreground hover:text-destructive focus:outline-none"
                onClick={e => { e.stopPropagation(); e.preventDefault(); console.log('[GitSourceControl] inline discard click, file:', file.path); handleDiscard(file.path) }}
                title="Discard"
                type="button"
              >
                <Codicon name="discard" size="0.625rem" />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div tabIndex={-1} className="flex h-full min-w-0 min-h-0 flex-col gap-2 p-3 outline-none" onFocus={handleFocus}>
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2">
        <Codicon name="source-control" size="1rem" className="shrink-0 text-foreground" />
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t.gitSourceControl || 'Source Control'}
        </span>
        {status.branch && (
          <DropdownMenu onOpenChange={(open) => {
            if (open && cwd.trim()) void gitLoadBranches(cwd)
          }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-2 py-1 hover:bg-(--ui-control-hover-background)"
              >
                <Codicon name="git-branch" size="0.75rem" className="text-foreground" />
                <span className="max-w-24 truncate text-xs font-medium text-foreground">{status.branch}</span>
                <Codicon name="chevron-down" size="0.75rem" className="text-muted-foreground ml-0.5" />
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

      {/* Commit input */}
      <div className="flex min-w-0 gap-1.5">
        <input
          className="min-w-0 max-w-64 flex-1 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          placeholder={t.gitCommitPlaceholder || 'Commit message'}
          value={commitMessage}
          onChange={e => $gitCommitMessage.set(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="sm"
          disabled={!commitMessage.trim() || stagedFiles.length === 0}
          onClick={handleCommit}
          className="shrink-0 px-3 py-1 text-xs"
        >
          <Codicon name="check" size="0.75rem" />
          {t.gitCommit || 'Commit'}
        </Button>
      </div>

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
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {t.gitStaged || 'Staged Changes'} ({stagedFiles.length})
                </span>
              </div>
              <div className="flex flex-col gap-px">
                {stagedFiles.map(f => renderFileItem(f, 'staged'))}
              </div>
            </div>
          )}
          {/* Changes (unstaged) — always show like VS Code */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                {t.gitChanges || 'Changes'} ({unstagedFiles.length})
              </span>
              {unstagedFiles.length > 0 && (
                <button
                  className="text-[0.6rem] text-muted-foreground hover:text-foreground"
                  onClick={handleStageAll}
                  type="button"
                >
                  {t.gitStageAll || 'Stage All'}
                </button>
              )}
            </div>
            {unstagedFiles.length > 0 && (
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
                  onClick={() => { console.log('[GitSourceControl] Stage Changes click, file:', contextMenu.file.path); handleStage(contextMenu.file.path) }}
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
    </div>
  )
}
