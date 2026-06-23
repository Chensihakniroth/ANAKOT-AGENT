import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef, useCallback } from 'react'
import ShikiHighlighter from 'react-shiki'

const SHIKI_THEME = { dark: 'github-dark-default', light: 'github-light-default' } as const

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

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    java: 'java',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    vim: 'vim',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    md: 'markdown',
    txt: 'text',
  }
  return languageMap[ext] || 'text'
}

function CodeEditorPane({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const language = getLanguageFromPath(filePath)
  const lineCount = content ? content.split('\n').length : 1

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const spaces = '  '

      if (e.shiftKey) {
        const beforeCursor = content?.substring(0, start) || ''
        const lastNewline = beforeCursor.lastIndexOf('\n')
        const lineStart = lastNewline + 1
        const lineContent = content?.substring(lineStart, start) || ''
        if (lineContent.startsWith('  ')) {
          const newContent = content?.substring(0, lineStart) + lineContent.substring(2) + content?.substring(start) || ''
          setContent(newContent)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2)
          }, 0)
        }
      } else {
        const newContent = content?.substring(0, start) + spaces + content?.substring(end) || ''
        setContent(newContent)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }
    }
  }, [content])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }, [])

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

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
    <div className="flex h-full overflow-hidden">
      <div
        ref={lineNumbersRef}
        className="shrink-0 select-none overflow-hidden bg-(--ui-bg-secondary) py-2 text-right font-mono text-xs leading-relaxed text-muted-foreground/50"
        style={{ width: '3rem' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="px-2">
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-0 overflow-hidden py-2">
          <ShikiHighlighter
            addDefaultStyles={false}
            as="div"
            defaultColor="light-dark()"
            language={language}
            theme={SHIKI_THEME}
            style={{ margin: 0, padding: 0, background: 'transparent' }}
          >
            {content || ''}
          </ShikiHighlighter>
        </div>
        <textarea
          ref={textareaRef}
          className="relative h-full w-full resize-none bg-transparent py-2 font-mono text-xs leading-relaxed text-transparent caret-foreground outline-none selection:bg-blue-500/30"
          style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
          value={content || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
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
          <CodeEditorPane key={activeTab.id} filePath={activeTab.path} />
        ) : (
          <WelcomeTab />
        )}
      </div>
    </div>
  )
}
