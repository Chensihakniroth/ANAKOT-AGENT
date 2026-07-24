import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import {
  CodeReviewPanel,
} from '@/app/chat/right-rail'
import { LazyDiffPreview as DiffPreview } from '@/app/chat/right-rail/lazy-monaco'
import { GitCommitPanel } from '@/app/chat/right-rail/git-commit'
import { PreviewPane } from '@/app/chat/right-rail/preview-pane'
import { Codicon } from '@/components/ui/codicon'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  $rightRailActiveTabId,
  RIGHT_RAIL_CODE_REVIEW_TAB_ID,
  RIGHT_RAIL_GIT_COMMIT_TAB_ID,
  RIGHT_RAIL_PREVIEW_TAB_ID,
  type RightRailTabId,
  selectRightRailTab,
} from '@/store/layout'
import {
  $codeReviewData,
} from '@/store/code-review'
import {
  $gitCommitData,
} from '@/store/git-commit'
import {
  $filePreviewTabs,
  $previewReloadRequest,
  $previewTarget,
  closeRightRail,
  closeRightRailTab,
} from '@/store/preview'
import type { PreviewTarget } from '@/store/preview'

interface PreviewMobileSheetProps {
  onRestartServer?: (url: string, context?: string) => Promise<string>
}

interface RailTab {
  id: RightRailTabId
  label: string
  target?: PreviewTarget
}

function tabLabelFor(target: PreviewTarget): string {
  const value = target.label || target.path || target.source || target.url
  const tail = value.split(/[\\/]/).filter(Boolean).at(-1)
  return tail || value || 'Preview'
}

/**
 * Mobile bottom sheet that mirrors the desktop right-rail preview content.
 * Slides up automatically when a preview target, code review, or file tab is
 * set while on a small screen.
 */
export function PreviewMobileSheet({ onRestartServer }: PreviewMobileSheetProps) {
  const isMobile = useIsMobile()
  const previewReloadRequest = useStore($previewReloadRequest)
  const activeTabId = useStore($rightRailActiveTabId)
  const filePreviewTabs = useStore($filePreviewTabs)
  const previewTarget = useStore($previewTarget)
  const codeReviewData = useStore($codeReviewData)
  const gitCommitData = useStore($gitCommitData)

  const hasContent = Boolean(previewTarget || codeReviewData || gitCommitData || filePreviewTabs.length > 0)
  const [open, setOpen] = useState(false)

  // Auto-open when content appears on mobile
  useEffect(() => {
    if (isMobile && hasContent) {
      setOpen(true)
    }
  }, [hasContent, isMobile])

  const tabs = useMemo<readonly RailTab[]>(
    () => [
      ...(previewTarget ? [{ id: RIGHT_RAIL_PREVIEW_TAB_ID, label: 'Preview', target: previewTarget } as RailTab] : []),
      ...(codeReviewData ? [{ id: RIGHT_RAIL_CODE_REVIEW_TAB_ID, label: 'Review' } as RailTab] : []),
      ...(gitCommitData ? [{ id: RIGHT_RAIL_GIT_COMMIT_TAB_ID, label: 'Commit' } as RailTab] : []),
      ...filePreviewTabs.map(({ id, target }) => ({ id, label: tabLabelFor(target), target }) as RailTab),
    ],
    [codeReviewData, filePreviewTabs, gitCommitData, previewTarget],
  )

  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]

  useEffect(() => {
    if (activeTab && activeTab.id !== activeTabId) {
      selectRightRailTab(activeTab.id)
    }
  }, [activeTab, activeTabId])

  const handleClose = () => {
    setOpen(false)
    closeRightRail()
  }

  const handleTabSelect = (tabId: RightRailTabId) => {
    selectRightRailTab(tabId)
  }

  if (!isMobile) return null
  if (!hasContent) return null

  const isPreviewTab = activeTab?.id === RIGHT_RAIL_PREVIEW_TAB_ID

  return (
    <Sheet open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) closeRightRail()
    }}>
      <SheetContent
        side="bottom"
        className="flex max-h-[80vh] flex-col p-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
        showCloseButton={false}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted" />

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto px-3 pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                aria-selected={tab.id === activeTab?.id}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab.id === activeTab?.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => handleTabSelect(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-0">
          {!activeTab ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              No preview
            </div>
          ) : activeTab.id === RIGHT_RAIL_CODE_REVIEW_TAB_ID ? (
            <CodeReviewPanel />
          ) : activeTab.id === RIGHT_RAIL_GIT_COMMIT_TAB_ID ? (
            <GitCommitPanel />
          ) : activeTab.target?.kind === 'diff' ? (
            <DiffPreview target={activeTab.target} />
          ) : (
            <PreviewPane
              embedded
              onRestartServer={isPreviewTab ? onRestartServer : undefined}
              reloadRequest={previewReloadRequest}
              target={activeTab.target!}
            />
          )}
        </div>

        {/* Close button */}
        <button
          aria-label="Close preview"
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={handleClose}
          type="button"
        >
          <Codicon name="close" size="1rem" />
        </button>
      </SheetContent>
    </Sheet>
  )
}
