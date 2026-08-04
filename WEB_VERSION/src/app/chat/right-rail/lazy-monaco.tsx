
import { lazy } from 'react'

// Bundle Monaco locally (no runtime CDN fetch) before any editor mounts.
// loader.config({ monaco }) in monaco-setup.ts must run before @monaco-editor/react
// kicks off its AMD loader — otherwise it falls back to jsdelivr and fails
// with "Monaco initialization: error: Error: [object Event]".
const loadMonacoSetup = () => import('@/lib/monaco-setup')

// Lazy-load Monaco editor pane — defers @monaco-editor/react (~5KB) until needed
export const LazyMonacoEditorPane = lazy(
  async () => {
    await loadMonacoSetup()
    return { default: (await import('./monaco-editor-pane')).MonacoEditorPane }
  }
)

// Lazy-load DiffPreview — also uses @monaco-editor/react
export const LazyDiffPreview = lazy(
  async () => {
    await loadMonacoSetup()
    return { default: (await import('./diff-preview')).DiffPreview }
  }
)
