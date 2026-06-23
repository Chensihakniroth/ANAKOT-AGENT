// MONACO_GUTTER_FIX_v3_20260623b
import { Editor, type BeforeMount, type OnMount } from '@monaco-editor/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useTheme } from '@/themes/context'

interface MonacoEditorPaneProps {
  value: string
  language: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onMount?: () => void
}

/** Map of file extensions to Monaco language identifiers. */
const EXT_TO_MONACO_LANG: Record<string, string> = {
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
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
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
  txt: 'plaintext',
  log: 'plaintext',
}

function getMonacoLanguage(text: string): string {
  const firstLine = text.split('\n')[0] ?? ''
  const shebangMatch = firstLine.match(/^#!.*\/([\w]+)/)
  if (shebangMatch) {
    const shebangLang = shebangMatch[1]
    if (shebangLang === 'bash' || shebangLang === 'sh') return 'shell'
    if (shebangLang === 'python' || shebangLang === 'python3') return 'python'
    if (shebangLang === 'node') return 'javascript'
    if (shebangLang === 'ruby') return 'ruby'
    if (shebangLang === 'perl') return 'perl'
  }
  return 'plaintext'
}

/** Resolve the CSS var(--ui-bg-editor) to a hex color for Monaco.
 *  Monaco themes require actual color values, not CSS variables.
 *  color-mix() can't be resolved via probe elements, so we compute the mix
 *  directly from the underlying CSS custom properties. */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')
}

function mixColor(a: string, b: string, amount: number): string {
  const ar = hexToRgb(a)
  const br = hexToRgb(b)
  if (!ar || !br) return a
  return rgbToHex(
    ar[0] + (br[0] - ar[0]) * amount / 100,
    ar[1] + (br[1] - ar[1]) * amount / 100,
    ar[2] + (br[2] - ar[2]) * amount / 100,
  )
}

function resolveEditorBackground(): string {
  if (typeof document === 'undefined') return '#1e1e1e'
  try {
    const rootStyle = getComputedStyle(document.documentElement)
    // Read the raw CSS vars that compose --ui-bg-editor:
    //   --ui-bg-editor: color-mix(in srgb, var(--theme-card-seed) VAR(--theme-mix-card), var(--theme-neutral-card))
    const cardSeed = rootStyle.getPropertyValue('--theme-card-seed').trim()
    const mixPct = rootStyle.getPropertyValue('--theme-mix-card').trim()
    const neutralCard = rootStyle.getPropertyValue('--theme-neutral-card').trim()
    if (cardSeed && mixPct && neutralCard) {
      const pct = parseFloat(mixPct)
      if (!isNaN(pct)) {
        return mixColor(cardSeed, neutralCard, pct)
      }
    }
    // Fallback: try to read a pre-resolved --ui-bg-editor
    const rawBg = rootStyle.getPropertyValue('--ui-bg-editor').trim()
    if (rawBg && !rawBg.includes('var(') && !rawBg.includes('color-mix(')) {
      if (rawBg.startsWith('#')) return rawBg
      const rgbMatch = rawBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]))
      }
    }
    return '#1e1e1e'
  } catch {
    return '#1e1e1e'
  }
}

// Module-level lock to prevent multiple editor instances
// (StrictMode or React re-renders can cause double-mounts)
let globalEditorLock = false

export function MonacoEditorPane({ value, language, readOnly = true, onChange, onMount }: MonacoEditorPaneProps) {
  const themeCtx = useTheme()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  const monacoLanguage = language === 'text' ? getMonacoLanguage(value) : (EXT_TO_MONACO_LANG[language] || language)
  const monacoTheme = themeCtx.resolvedMode === 'dark' ? 'anakot-dark' : 'anakot-light'

  const mountCountRef = useRef(0)
  const monacoRef = useRef<any>(null)

  // Re-define and re-applying Monaco themes whenever the theme changes.
  // handleBeforeMount only runs once, so we need this effect to update
  // the theme colors on live theme switches (like VS Code does).
  const applyMonacoTheme = useCallback((monacoInstance: any) => {
    // Small delay to ensure CSS custom properties have been updated
    // by applyTheme() in the ThemeContext before we read them.
    requestAnimationFrame(() => {
      const bg = resolveEditorBackground()
      monacoInstance.editor.defineTheme('anakot-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': bg,
        },
      })
      monacoInstance.editor.defineTheme('anakot-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': bg,
        },
      })
      const themeName = themeCtx.resolvedMode === 'dark' ? 'anakot-dark' : 'anakot-light'
      monacoInstance.editor.setTheme(themeName)
    })
  }, [themeCtx.resolvedMode])

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // If an editor is already mounted globally, skip this mount
    if (globalEditorLock) {
      console.log('[MonacoDiag] skipping duplicate editor mount (global lock)')
      return
    }
    globalEditorLock = true

    mountCountRef.current++
    const bg = resolveEditorBackground()
    console.log('[MonacoDiag] beforeMount #' + mountCountRef.current, 'bg:', bg)
    // Only override editor.background — let the base theme handle the gutter
    // to avoid ghost/duplicate line number rendering artifacts.
    monaco.editor.defineTheme('anakot-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': bg,
      },
    })
    monaco.editor.defineTheme('anakot-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': bg,
      },
    })
  }, [])

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setReady(true)
    onMount?.()

    // Apply the custom theme after mount
    applyMonacoTheme(monaco)
    console.log('[MonacoDiag] mount #' + mountCountRef.current, 'theme:', themeCtx.resolvedMode)

    // After mount, the flex container may not have stable dimensions yet.
    // Use rAF + setTimeout to catch the final size after the browser paints.
    requestAnimationFrame(() => {
      setTimeout(() => {
        editor.layout()
        console.log('[MonacoDiag] post-mount layout done')
      }, 0)
    })
  }, [onMount, themeCtx.resolvedMode, applyMonacoTheme])

  // Live theme-switch: re-apply Monaco theme when theme context changes
  // This ensures the editor background updates when the user switches skins.
  useEffect(() => {
    if (ready && monacoRef.current) {
      applyMonacoTheme(monacoRef.current)
    }
  }, [themeCtx.resolvedMode, themeCtx.themeName, ready, applyMonacoTheme])

  // Clear residual DOM from previous editor instances before mount.
  // useLayoutEffect runs before the browser paints, preventing flicker.
  useLayoutEffect(() => {
    if (containerRef.current) {
      // Remove any leftover gutter nodes from previous mounts
      const leftovers = containerRef.current.querySelectorAll('.monaco-editor')
      leftovers.forEach((el, i) => {
        if (i > 0) el.remove() // keep only the first (current) editor
      })
    }
  }, [])

  const handleChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange?.(newValue)
    }
  }, [onChange])

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ backgroundColor: 'var(--ui-bg-editor)' }}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading editor…
          </div>
        </div>
      )}
      <Editor
        value={value}
        language={monacoLanguage}
        theme={monacoTheme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={readOnly ? undefined : handleChange}
        loading={null}
        options={{
          readOnly,
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false,
            verticalSliderSize: 10,
          },
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          padding: { top: 4, bottom: 4 },
          automaticLayout: true,
          glyphMargin: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'none',
          bracketPairColorization: { enabled: true },
          links: false,
          hover: { enabled: readOnly },
          quickSuggestions: !readOnly,
          suggestOnTriggerCharacters: !readOnly,
          parameterHints: { enabled: !readOnly },
          largeFileOptimizations: true,
        }}
        width="100%"
        height="100%"
      />
    </div>
  )
}
