import { useEffect, useMemo, useCallback, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { $currentCwd } from '@/store/session'
import { setCurrentSessionPreviewTarget } from '@/store/preview'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { setBottomPanelTab, setBottomPanelOpen } from '@/store/workbench'
import {
  $gitStatus, $gitLoading, $gitCommitMessage, $gitError,
  refreshGitStatus, gitStageFile, gitStageAllFiles, gitUnstageFile, gitDiscardChanges, gitCommit,
  type GitFile
} from '@/store/git'

interface ContextMenuState {
  x: number
  y: number
  file: GitFile
  type: 'staged' | 'changes' | 'untracked'
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
  const error = useStore($gitError)
  const loading = useStore($gitLoading)
  const commitMessage = useStore($gitCommitMessage)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    if (cwd.trim()) {
      void refreshGitStatus(cwd)
    }
  }, [cwd])

  // Refresh when the panel becomes visible (sidebar tab switch)
  const handleFocus = useCallback(() => {
    if (cwd.trim()) {
      void refreshGitStatus(cwd)
    }
  }, [cwd])

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && cwd.trim()) {
        void refreshGitStatus(cwd)
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
  const unstagedFiles = useMemo(() => status.files.filter(f => f.unstaged && f.status !== 'untracked'), [status.files])
  const untrackedFiles = useMemo(() => status.files.filter(f => f.status === 'untracked'), [status.files])

  const handleStage = useCallback(async (file: string) => {
    setContextMenu(null)
    await gitStageFile(cwd, file)
  }, [cwd])

  const handleUnstage = useCallback(async (file: string) => {
    setContextMenu(null)
    await gitUnstageFile(cwd, file)
  }, [cwd])

  const handleDiscard = useCallback(async (file: string) => {
    setContextMenu(null)
    if (window.confirm(`Discard changes to "${file}"?`)) {
      await gitDiscardChanges(cwd, file)
    }
  }, [cwd])

  const handleStageAll = useCallback(async () => {
    setContextMenu(null)
    const files = [...unstagedFiles, ...untrackedFiles].map(f => f.path)
    if (files.length > 0) {
      await gitStageAllFiles(cwd, files)
    }
  }, [cwd, unstagedFiles, untrackedFiles])

  const handleCommit = useCallback(async () => {
    if (commitMessage.trim()) {
      await gitCommit(cwd, commitMessage)
    }
  }, [cwd, commitMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void handleCommit()
    }
  }, [handleCommit])

  const openContextMenu = useCallback((e: React.MouseEvent, file: GitFile, type: 'staged' | 'changes' | 'untracked') => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file, type })
  }, [])

  const handleOpenFile = useCallback(async (file: string) => {
    setContextMenu(null)
    const root = status.root || cwd
    const absolutePath = file.startsWith('/') ? file : `${root.replace(/\\/g, '/')}/${file}`
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
    const absolutePath = file.startsWith('/') ? file : `${root.replace(/\\/g, '/')}/${file}`
    const parentDir = absolutePath.split('/').slice(0, -1).join('/') || '/'
    void window.anakotDesktop?.openExternal?.(`file://${parentDir}`)
  }, [cwd, status.root])

  const renderFileItem = (file: GitFile, type: 'staged' | 'changes' | 'untracked') => {
    const statusInfo = STATUS_ICONS[file.status] || STATUS_ICONS.modified
    return (
      <div
        key={file.path}
        className="group flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-(--ui-control-hover-background)"
        onContextMenu={e => openContextMenu(e, file, type)}
      >
        <Codicon name={statusInfo.icon} size="0.75rem" className={`shrink-0 ${statusInfo.color}`} />
        <span className="flex-1 truncate text-foreground" title={file.path}>{file.path.split('/').pop()}</span>
        <span className="text-[0.6rem] uppercase text-muted-foreground">{file.status}</span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {type === 'staged' && (
            <button
              className="rounded-sm p-0.5 hover:bg-(--ui-control-active-background)"
              onClick={() => handleUnstage(file.path)}
              title="Unstage"
              type="button"
            >
              <Codicon name="remove" size="0.625rem" />
            </button>
          )}
          {type === 'changes' && (
            <>
              <button
                className="rounded-sm p-0.5 hover:bg-(--ui-control-active-background)"
                onClick={() => handleStage(file.path)}
                title="Stage"
                type="button"
              >
                <Codicon name="add" size="0.625rem" />
              </button>
              <button
                className="rounded-sm p-0.5 hover:bg-(--ui-control-active-background)"
                onClick={() => handleDiscard(file.path)}
                title="Discard"
                type="button"
              >
                <Codicon name="discard" size="0.625rem" />
              </button>
            </>
          )}
          {type === 'untracked' && (
            <button
              className="rounded-sm p-0.5 hover:bg-(--ui-control-active-background)"
              onClick={() => handleStage(file.path)}
              title="Stage"
              type="button"
            >
              <Codicon name="add" size="0.625rem" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 min-h-0 flex-col gap-2 p-3" onFocus={handleFocus}>
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2">
        <Codicon name="source-control" size="1rem" className="shrink-0 text-foreground" />
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t.gitSourceControl || 'Source Control'}
        </span>
        {status.branch && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) px-2 py-1">
            <Codicon name="git-branch" size="0.75rem" className="text-foreground" />
            <span className="max-w-24 truncate text-xs font-medium text-foreground">{status.branch}</span>
          </div>
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
      {!loading && status.root && status.files.length > 0 && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Staged Changes — always show like VS Code */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                {t.gitStaged || 'Staged Changes'} ({stagedFiles.length})
              </span>
            </div>
            {stagedFiles.length > 0 && (
              <div className="flex flex-col gap-px">
                {stagedFiles.map(f => renderFileItem(f, 'staged'))}
              </div>
            )}
          </div>
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
          {/* Untracked — always show like VS Code */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                {t.gitUntracked || 'Untracked'} ({untrackedFiles.length})
              </span>
            </div>
            {untrackedFiles.length > 0 && (
              <div className="flex flex-col gap-px">
                {untrackedFiles.map(f => renderFileItem(f, 'untracked'))}
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
                  onClick={() => handleStage(contextMenu.file.path)}
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
            {contextMenu.type === 'untracked' && (
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
                onClick={() => handleStage(contextMenu.file.path)}
                type="button"
              >
                <Codicon name="add" size="0.75rem" />
                Stage Changes
              </button>
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
    </div>
  )
}
