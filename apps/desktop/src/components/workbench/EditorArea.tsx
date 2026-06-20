import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'

interface EditorTab {
  id: string
  path: string
  label: string
  dirty: boolean
}

interface EditorAreaProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onSetActiveTab: (id: string | null) => void
  onCloseTab: (id: string) => void
}

function EditorTabBar({ tabs, activeId, onSetActiveTab, onCloseTab }: {
  tabs: EditorTab[]
  activeId: string | null
  onSetActiveTab: (id: string | null) => void
  onCloseTab: (id: string) => void
}) {
  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-(--ui-stroke-secondary) bg-(--ui-tab-inactive-background)">
      {tabs.map(tab => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            className={cn(
              'flex h-full shrink-0 items-center gap-1.5 border-r border-(--ui-stroke-secondary) px-3 text-xs transition-colors',
              isActive
                ? 'bg-(--ui-tab-active-background) text-foreground'
                : 'text-muted-foreground hover:text-(--ui-text-secondary)'
            )}
            onClick={() => onSetActiveTab(tab.id)}
            type="button"
          >
            <Codicon name="file-code" size="0.75rem" />
            <span className="max-w-[120px] truncate">{tab.label}</span>
            {tab.dirty && <span className="size-2 rounded-full bg-foreground/40" />}
            <span
              className="ml-0.5 flex size-4 items-center justify-center rounded-sm transition-colors hover:bg-(--ui-control-hover-background)"
              onClick={e => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              onMouseDown={e => e.preventDefault()}
            >
              <Codicon name="chrome-close" size="0.625rem" />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WelcomeTab() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <Codicon name="file-code" size="3rem" className="text-muted-foreground/30" />
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">No file open</h2>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Open a file from the Explorer to start editing
        </p>
      </div>
    </div>
  )
}

function CodeEditorPane({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    window.anakotDesktop?.readFileText(filePath)
      .then(result => {
        if (cancelled) return
        if (result.text !== undefined) {
          setContent(result.text)
        } else {
          setError('File could not be read')
        }
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Failed to read file')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [filePath])

  useEffect(() => {
    if (content && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [content])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Codicon name="loading" size="1.5rem" className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Codicon name="error" size="2rem" className="text-destructive/50" />
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      className="h-full w-full resize-none bg-transparent p-2 font-mono text-xs text-foreground outline-none"
      value={content || ''}
      onChange={e => setContent(e.target.value)}
      spellCheck={false}
      style={{
        tabSize: 2,
        lineHeight: '1.5',
      }}
    />
  )
}

export function EditorArea({ tabs, activeTabId, onSetActiveTab, onCloseTab }: EditorAreaProps) {
  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <EditorTabBar
        tabs={tabs}
        activeId={activeTabId}
        onSetActiveTab={onSetActiveTab}
        onCloseTab={onCloseTab}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-(--ui-chat-surface-background)">
        {activeTab ? (
          <CodeEditorPane filePath={activeTab.path} />
        ) : (
          <WelcomeTab />
        )}
      </div>
    </div>
  )
}
