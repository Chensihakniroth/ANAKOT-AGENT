
import { lazy } from 'react'

// Lazy-load Monaco editor pane — defers @monaco-editor/react (~5KB) until needed
export const LazyMonacoEditorPane = lazy(
  async () => ({ default: (await import('./monaco-editor-pane')).MonacoEditorPane })
)

// Lazy-load DiffPreview — also uses @monaco-editor/react
export const LazyDiffPreview = lazy(
  async () => ({ default: (await import('./diff-preview')).DiffPreview })
)
