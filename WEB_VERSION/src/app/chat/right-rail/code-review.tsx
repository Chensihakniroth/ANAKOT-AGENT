import { useStore } from '@nanostores/react'
import { useCallback } from 'react'

import { $reviewState, clearReview, reviewSummary, type ReviewItem } from '@/store/code-review'
import { RIGHT_RAIL_CODE_REVIEW_TAB_ID } from '@/store/layout'

const severityBadge: Record<string, string> = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const categoryLabels: Record<string, string> = {
  bug: '🐛 Bug',
  style: '🎨 Style',
  security: '🔒 Security',
  performance: '⚡ Performance',
  suggestion: '💡 Suggestion',
}

export function CodeReviewPanel() {
  const review = useStore($reviewState)
  const { items, loading, file, error } = review
  const summary = reviewSummary(items)

  const handleClear = useCallback(() => {
    clearReview()
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-xs">Reviewing <span className="font-mono text-foreground">{file || '...'}</span></span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-red-400">Review failed: {error}</p>
          <button onClick={handleClear} className="mt-3 text-xs px-3 py-1 rounded bg-border/50 hover:bg-border transition-colors">Dismiss</button>
        </div>
      </div>
    )
  }

  // Empty / no review
  if (!file || items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <p className="text-xs">No review results</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[10px] font-bold font-mono tracking-[0.15em] text-foreground/60">REVIEW</span>
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{file.split(/[/\\]/).pop()}</span>

        {/* Summary badges */}
        <div className="ml-auto flex items-center gap-1.5">
          {summary.error > 0 && (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              {summary.error}
            </span>
          )}
          {summary.warning > 0 && (
            <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
              {summary.warning}
            </span>
          )}
          {summary.info > 0 && (
            <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
              {summary.info}
            </span>
          )}
          <button onClick={handleClear} className="ml-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {(['bug', 'security', 'performance', 'style', 'suggestion'] as const).map(category => {
          const catItems = items.filter(i => i.category === category)
          if (catItems.length === 0) return null
          return (
            <div key={category}>
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 border-b border-border/40">
                {categoryLabels[category]}
              </div>
              {catItems.map((item, idx) => (
                <ReviewItemRow key={`${category}-${idx}`} item={item} file={file} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewItemRow({ item, file }: { item: ReviewItem; file: string }) {
  const badge = severityBadge[item.severity] ?? severityBadge.info

  const handleLineClick = useCallback(() => {
    window.anakotDesktop.api({ path: '/api/openFile', body: { path: file, line: item.line } })
      .catch(() => {
        // Fallback: open the file at the line via the API
        window.anakotDesktop.api({ path: `file://${file.replace(/\\/g, '/')}` })
      })
  }, [file, item.line])

  return (
    <div className="group border-b border-border/20 px-3 py-2 text-xs hover:bg-accent/20 transition-colors">
      <div className="flex items-start gap-2">
        {/* Severity badge */}
        <span className={`shrink-0 mt-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase border ${badge}`}>
          {item.severity}
        </span>

        {/* Message */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground/90 leading-relaxed">{item.message}</p>
          {item.suggestion && (
            <p className="mt-1 text-muted-foreground/80 leading-relaxed">{item.suggestion}</p>
          )}
        </div>

        {/* Line number */}
        <button
          onClick={handleLineClick}
          className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60 hover:text-foreground hover:bg-border/50 transition-colors"
          title="Go to line"
        >
          L{item.line}
        </button>
      </div>
    </div>
  )
}
