import { useStore } from '@nanostores/react'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { $editorTabs, $activeEditorTabId, setActiveEditorTab, closeEditorTab } from '@/store/workbench'
import Editor from '@monaco-editor/react'

function EditorTabBar() {
  const tabs = useStore($editorTabs)
  const activeId = useStore($activeEditorTabId)

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
            onClick={() => setActiveEditorTab(tab.id)}
            type="button"
          >
            <Codicon name="file-code" size="0.75rem" />
            <span className="max-w-[120px] truncate">{tab.label}</span>
            {tab.dirty && <span className="size-2 rounded-full bg-foreground/40" />}
            <span
              className="ml-0.5 flex size-4 items-center justify-center rounded-sm transition-colors hover:bg-(--ui-control-hover-background)"
              onClick={e => {
                e.stopPropagation()
                closeEditorTab(tab.id)
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

function MonacoEditorPane({ filePath }: { filePath: string }) {
  return (
    <Editor
      height="100%"
      path={filePath}
      theme="vs-dark"
      options={{
        fontSize: 13,
        lineNumbers: 'on',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 8 },
      }}
    />
  )
}

export function EditorArea() {
  const activeId = useStore($activeEditorTabId)
  const tabs = useStore($editorTabs)
  const activeTab = tabs.find(t => t.id === activeId)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <EditorTabBar />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-(--ui-chat-surface-background)">
        {activeTab ? (
          <MonacoEditorPane filePath={activeTab.path} />
        ) : (
          <WelcomeTab />
        )}
      </div>
    </div>
  )
}
