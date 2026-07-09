import { useCallback, useState } from 'react'
import { useStore } from '@nanostores/react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PromptDialog } from '@/components/ui/prompt-dialog'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { $currentCwd } from '@/store/session'
import { ProjectTree } from '@/app/right-sidebar/files/tree'
import { useProjectTree } from '@/app/right-sidebar/files/use-project-tree'
import { openEditorTab, openRecentFile } from '@/store/workbench'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { setCurrentSessionPreviewTarget } from '@/store/preview'
import { notifyError } from '@/store/notifications'

interface ExplorerProps {
  onOpenFile: (path: string) => void
}

export function Explorer({ onOpenFile }: ExplorerProps) {
  const { t } = useI18n()
  const r = t.rightSidebar
  const currentCwd = useStore($currentCwd).trim()
  const hasCwd = currentCwd.length > 0

  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const cwdName = hasCwd
    ? (currentCwd.split(/[\\/]+/).filter(Boolean).pop() ?? currentCwd)
    : r.noFolderSelected

  const {
    collapseAll,
    collapseNonce,
    data,
    loadChildren,
    openState,
    refreshRoot,
    rootError,
    rootLoading,
    setNodeOpen
  } = useProjectTree(currentCwd)

  const canCollapse = Object.values(openState).some(Boolean)

  const chooseFolder = async () => {
    const selected = await window.anakotDesktop?.selectPaths({
      defaultPath: hasCwd ? currentCwd : undefined,
      directories: true,
      multiple: false,
      title: r.changeCwdTitle
    })
    if (selected?.[0]) {
      // Change cwd via the session store
      const { setCurrentCwd } = await import('@/store/session')
      setCurrentCwd(selected[0])
    }
  }

  const handleActivateFile = async (path: string) => {
    try {
      const preview = await normalizeOrLocalPreviewTarget(path, currentCwd || undefined)
      if (preview) {
        setCurrentSessionPreviewTarget(preview, 'file-browser', path)
      }
      const label = path.split(/[\\/]/).pop() || path
      openRecentFile(path, label)
      onOpenFile(path)
    } catch (error) {
      notifyError(error, r.previewUnavailable)
    }
  }

  const previewFile = async (path: string) => {
    try {
      const preview = await normalizeOrLocalPreviewTarget(path, currentCwd || undefined)
      if (!preview) {
        throw new Error(r.couldNotPreview(path))
      }
      setCurrentSessionPreviewTarget(preview, 'file-browser', path)
    } catch (error) {
      notifyError(error, r.previewUnavailable)
    }
  }

  const handleRenameFile = useCallback((path: string) => {
    setRenameTarget(path)
  }, [])

  const doRename = async (newName: string) => {
    if (!renameTarget || !newName) return
    const path = renameTarget
    const name = path.split(/[\\/]/).pop() || path
    if (newName !== name) {
      const parentDir = path.split(/[\\/]/).slice(0, -1).join('/') || '/'
      const newPath = `${parentDir}/${newName}`
      const result = await window.anakotDesktop?.renameFile?.(path, newPath)
      if (result?.ok) {
        void window.anakotDesktop?.notify?.({
          title: 'Renamed',
          body: `${name} → ${newName}`,
        })
        refreshRoot()
      } else {
        throw new Error(result?.error || 'Unknown error')
      }
    }
    setRenameTarget(null)
  }

  const handleDeleteFile = useCallback((path: string) => {
    setDeleteTarget(path)
  }, [])

  const doDelete = async () => {
    if (!deleteTarget) return
    const path = deleteTarget
    const name = path.split(/[\\/]/).pop() || path
    const result = await window.anakotDesktop?.deleteFile?.(path)
    if (result?.ok) {
      void window.anakotDesktop?.notify?.({
        title: 'Deleted',
        body: name,
      })
      refreshRoot()
    } else {
      throw new Error(result?.error || 'Unknown error')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="group/project-header flex min-h-0 flex-1 flex-col">
      {/* Explorer header - folder name + actions */}
      <div className="flex h-7 shrink-0 items-center gap-1 px-2">
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left text-xs font-medium hover:text-foreground"
          onClick={() => void chooseFolder()}
          type="button"
          title={hasCwd ? currentCwd : r.openFolder}
        >
          <Codicon name="folder" size="0.75rem" className="shrink-0" />
          <span className="truncate">{cwdName}</span>
        </button>
        <button
          aria-label={r.refreshTree}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
          disabled={!hasCwd || rootLoading}
          onClick={refreshRoot}
          type="button"
        >
          <Codicon name="refresh" size="0.75rem" spinning={rootLoading} />
        </button>
        <button
          aria-label={r.openFolder}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={() => void chooseFolder()}
          type="button"
        >
          <Codicon name="folder-opened" size="0.75rem" />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: '100%' }}>
        {!currentCwd ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">
              {r.noProjectTitle}
            </div>
            <div className="text-[0.68rem] leading-relaxed text-muted-foreground/65">
              {r.noProjectBody}
            </div>
          </div>
        ) : rootError ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">
              {r.unreadableTitle}
            </div>
            <div className="text-[0.68rem] leading-relaxed text-muted-foreground/65">
              {r.unreadableBody(rootError)}
            </div>
          </div>
        ) : rootLoading && data.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center px-3" role="status">
            <Codicon name="loading" size="1.5rem" className="animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">
              {r.emptyTitle}
            </div>
            <div className="text-[0.68rem] leading-relaxed text-muted-foreground/65">
              {r.emptyBody}
            </div>
          </div>
        ) : (
          <ProjectTree
            collapseNonce={collapseNonce}
            cwd={currentCwd}
            data={data}
            onActivateFile={handleActivateFile}
            onActivateFolder={() => {}}
            onLoadChildren={loadChildren}
            onNodeOpenChange={setNodeOpen}
            onPreviewFile={previewFile}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            openState={openState}
          />
        )}
      </div>

      <PromptDialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        onConfirm={doRename}
        title="Rename"
        defaultValue={renameTarget ? (renameTarget.split(/[\\/]/).pop() || '') : ''}
        confirmLabel="Rename"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete File"
        description={`Are you sure you want to delete "${deleteTarget ? deleteTarget.split(/[\\/]/).pop() : ''}"?`}
        confirmLabel="Delete"
        destructive={true}
      />
    </div>
  )
}
