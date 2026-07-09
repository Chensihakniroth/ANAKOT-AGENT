import { DiffEditor } from '@monaco-editor/react'
import { useCallback } from 'react'
import type { PreviewTarget } from '@/store/preview'

interface DiffPreviewProps {
  target: PreviewTarget
}

export function DiffPreview({ target }: DiffPreviewProps) {
  const originalContent = target.originalContent ?? ''
  const modifiedContent = target.modifiedContent ?? ''

  const handleMount = useCallback(() => {
    // Monaco DiffEditor is mounted — ready for annotations, etc.
  }, [])

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-transparent text-muted-foreground">
      {/* Toolbar */}
      <div className="flex min-h-(--titlebar-height) shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3 py-1">
        <span className="text-[10px] font-bold font-mono tracking-[0.15em] text-foreground/60">DIFF</span>
        <span className="min-w-0 truncate text-xs font-medium text-foreground">
          {target.label || 'Diff'}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/60">
          {target.source}
        </span>
      </div>

      {/* Diff editor */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <DiffEditor
          language={target.language || 'plaintext'}
          original={originalContent}
          modified={modifiedContent}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            enableSplitViewResizing: true,
            renderSideBySide: true,
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            diffAlgorithm: 'advanced',
          }}
        />
      </div>
    </aside>
  )
}
