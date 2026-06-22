import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { triggerHaptic } from '@/lib/haptics'
import { useTheme } from '@/themes/context'

import { isAddSelectionShortcut, terminalSelectionAnchor, terminalSelectionLabel } from './selection'

/** Read the fully-resolved background color from a DOM element that has the CSS var applied.
 *  getComputedStyle().backgroundColor resolves color-mix() chains into plain rgb()/rgba()
 *  strings that xterm.js can parse. Reading the raw var via getPropertyValue would return
 *  the literal "color-mix(...)" text which xterm cannot understand. */
function resolveThemeBackground(el: HTMLElement): string {
  const resolved = getComputedStyle(el).backgroundColor
  // Fallback to the old Solarized bg if something goes wrong
  return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : '#002b36'
}

/** Resolve a CSS variable's computed color by reading it off a live element.
 *  Falls back to fallback if the value is empty/transparent. */
function resolveCssColorVar(el: HTMLElement, varName: string, fallback: string): string {
  const val = getComputedStyle(el).getPropertyValue(varName).trim()
  if (!val) return fallback
  // If it's a simple hex/color value, return as-is
  // If it's color-mix(...), we need to read a computed property instead
  if (val.startsWith('color-mix')) {
    // Can't resolve color-mix from getPropertyValue — return fallback
    // (the caller should use a computed property like backgroundColor instead)
    return fallback
  }
  return val
}

type TerminalStatus = 'closed' | 'open' | 'starting'

const ANAKOT_PATHS_MIME = 'application/x-anakot-paths'

function readEscapeSequence(data: string, index: number) {
  if (data.charCodeAt(index) !== 0x1b || index + 1 >= data.length) {
    return null
  }

  const kind = data[index + 1]

  if (kind === '[') {
    for (let i = index + 2; i < data.length; i += 1) {
      const code = data.charCodeAt(i)

      if (code >= 0x40 && code <= 0x7e) {
        return data.slice(index, i + 1)
      }
    }
  }

  if (kind === ']') {
    for (let i = index + 2; i < data.length; i += 1) {
      if (data.charCodeAt(i) === 0x07) {
        return data.slice(index, i + 1)
      }

      if (data.charCodeAt(i) === 0x1b && data[i + 1] === '\\') {
        return data.slice(index, i + 2)
      }
    }
  }

  return data.slice(index, Math.min(index + 2, data.length))
}

function stripEscapeSequences(data: string) {
  let index = 0
  let text = ''

  while (index < data.length) {
    const sequence = readEscapeSequence(data, index)

    if (sequence) {
      index += sequence.length
    } else {
      text += data[index]
      index += 1
    }
  }

  return text
}

function isStartupSpacer(data: string) {
  const text = stripEscapeSequences(data).replace(/[\s\r\n]/g, '')

  return text === '' || text === '%'
}

function stripInitialPromptGap(data: string) {
  let index = 0
  let prefix = ''

  while (index < data.length) {
    const sequence = readEscapeSequence(data, index)

    if (sequence) {
      prefix += sequence
      index += sequence.length
    } else if (data[index] === '\r' || data[index] === '\n') {
      index += 1
    } else {
      return prefix + data.slice(index)
    }
  }

  return prefix
}

interface UseTerminalSessionOptions {
  cwd: string
  onAddSelectionToChat: (text: string, label?: string) => void
  shell?: 'powershell' | 'git-bash' | 'cmd'
}

function transferHasDropCandidates(t: DataTransfer) {
  if (t.types?.includes(ANAKOT_PATHS_MIME)) {
    return true
  }

  if ((t.files?.length ?? 0) > 0) {
    return true
  }

  for (let i = 0; i < (t.items?.length ?? 0); i += 1) {
    if (t.items[i]?.kind === 'file') {
      return true
    }
  }

  return false
}

function collectDroppedPaths(t: DataTransfer): string[] {
  const seen = new Set<string>()

  const push = (value: unknown) => {
    if (typeof value !== 'string') {
      return
    }

    const path = value.trim()

    if (path) {
      seen.add(path)
    }
  }

  try {
    const raw = t.getData(ANAKOT_PATHS_MIME)

    if (raw) {
      for (const entry of JSON.parse(raw) as { path?: unknown }[]) {
        push(entry?.path)
      }
    }
  } catch {
    // Malformed in-app drag payload — fall through to OS files.
  }

  const getPath = window.anakotDesktop?.getPathForFile

  const addFile = (file: File | null) => {
    if (!file || !getPath) {
      return
    }

    try {
      push(getPath(file))
    } catch {
      // File handle unavailable.
    }
  }

  for (let i = 0; i < (t.files?.length ?? 0); i += 1) {
    addFile(t.files.item(i))
  }

  for (let i = 0; i < (t.items?.length ?? 0); i += 1) {
    const item = t.items[i]

    if (item?.kind === 'file') {
      addFile(item.getAsFile())
    }
  }

  return [...seen]
}

function quotePathForShell(path: string, shellName: string): string {
  const shell = shellName.toLowerCase()

  if (shell.includes('powershell') || shell.includes('pwsh')) {
    return `'${path.replace(/'/g, "''")}'`
  }

  if (shell.includes('cmd')) {
    return `"${path.replace(/"/g, '""')}"`
  }

  return `'${path.replace(/'/g, "'\\''")}'`
}

export function useTerminalSession({ cwd, onAddSelectionToChat, shell }: UseTerminalSessionOptions) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const shellNameRef = useRef('shell')
  const selectionLabelRef = useRef('')
  const selectionRef = useRef('')
  const onAddSelectionToChatRef = useRef(onAddSelectionToChat)
  const [status, setStatus] = useState<TerminalStatus>('starting')
  const [selection, setSelection] = useState('')
  const [selectionStyle, setSelectionStyle] = useState<CSSProperties | null>(null)
  const [shellName, setShellName] = useState('shell')
  const themeCtx = useTheme()

  useEffect(() => {
    onAddSelectionToChatRef.current = onAddSelectionToChat
  }, [onAddSelectionToChat])

  const addSelectionToChat = useCallback(() => {
    const selectedText = selectionRef.current || termRef.current?.getSelection() || ''

    const label =
      selectionLabelRef.current ||
      (termRef.current ? terminalSelectionLabel(termRef.current, shellNameRef.current, selectedText) : 'selection')

    const trimmed = selectedText.trim()

    if (!trimmed) {
      return
    }

    onAddSelectionToChatRef.current(trimmed, label)
    termRef.current?.clearSelection()
    selectionRef.current = ''
    selectionLabelRef.current = ''
    setSelection('')
    setSelectionStyle(null)
    triggerHaptic('selection')
  }, [])

  useEffect(() => {
    if (!selection.trim()) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isAddSelectionShortcut(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      addSelectionToChat()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [addSelectionToChat, selection])

  // SINGLE terminal lifecycle effect — handles creation, shell switch, and cwd change
  // Dependency array: [shell, cwd] — one effect to rule them all
  useEffect(() => {
    const host = hostRef.current
    const terminalApi = window.anakotDesktop?.terminal

    if (!host || !terminalApi) {
      setStatus('closed')
      return
    }

    let disposed = false
    const cleanup: Array<() => void> = []
    let lastSentSize: { cols: number; rows: number } | null = null

    // If a previous session exists, dispose it first
    const prevId = sessionIdRef.current
    if (prevId) {
      console.log('[terminal] disposing previous session:', prevId)
      void terminalApi.dispose(prevId)
      sessionIdRef.current = null
    }

    // If a previous xterm instance exists, dispose it
    const prevTerm = termRef.current
    if (prevTerm) {
      prevTerm.dispose()
      termRef.current = null
    }

    // Resolve theme background from the container parent (which has var(--ui-bg-editor) applied).
    // This resolves color-mix() chains into plain rgb() strings that xterm.js can parse.
    const themeBg = host.parentElement ? resolveThemeBackground(host.parentElement) : '#002b36'
    // Also resolve foreground from theme context for contrast
    const themeFg = themeCtx.theme.colors.foreground || '#839496'

    console.log('[terminal] theme bg resolved:', themeBg, 'from theme:', themeCtx.themeName, 'mode:', themeCtx.resolvedMode)

    const term = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: "'SF Mono', 'Menlo', 'Cascadia Code', 'JetBrains Mono', monospace",
      fontSize: 11,
      lineHeight: 1.12,
      macOptionIsMeta: true,
      scrollback: 1000,
      theme: {
        background: themeBg,
        foreground: themeFg,
        cursor: themeFg,
        cursorAccent: themeBg,
        selectionBackground: '#586e7555',
        black: '#073642',
        red: '#dc322f',
        green: '#859900',
        yellow: '#b58900',
        blue: '#268bd2',
        magenta: '#d33682',
        cyan: '#2aa198',
        white: '#eee8d5',
        brightBlack: '#586e75',
        brightRed: '#f25c54',
        brightGreen: '#b3d437',
        brightYellow: '#f7c948',
        brightBlue: '#5fb3ff',
        brightMagenta: '#ff6ab4',
        brightCyan: '#5cd9c8',
        brightWhite: '#fdf6e3'
      }
    })

    const fit = new FitAddon()

    termRef.current = term
    term.loadAddon(fit)
    term.loadAddon(new Unicode11Addon())
    term.loadAddon(new WebLinksAddon())
    term.unicode.activeVersion = '11'
    term.open(host)

    // WebGL renderer
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch (err) {
      console.warn('[anakot-terminal] WebGL unavailable; falling back to DOM', err)
    }

    // Drag and drop handlers
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !transferHasDropCandidates(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = (e: DragEvent) => {
      const id = sessionIdRef.current
      if (!id || !e.dataTransfer || !transferHasDropCandidates(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      const paths = collectDroppedPaths(e.dataTransfer)
      if (!paths.length) return
      void terminalApi.write(id, `${paths.map(p => quotePathForShell(p, shellNameRef.current)).join(' ')} `)
      term.focus()
      triggerHaptic('selection')
    }

    host.addEventListener('dragenter', onDragOver)
    host.addEventListener('dragover', onDragOver)
    host.addEventListener('drop', onDrop)
    cleanup.push(() => {
      host.removeEventListener('dragenter', onDragOver)
      host.removeEventListener('dragover', onDragOver)
      host.removeEventListener('drop', onDrop)
    })

    // Fit and resize handler — fit.fit() is the single source of truth
    let lastCols = 0
    let lastRows = 0

    const fitAndResize = () => {
      if (disposed || !host.isConnected) return
      if (host.clientWidth <= 0 || host.clientHeight <= 0) return

      try {
        const dimsBefore = { rows: term.rows, cols: term.cols }
        fit.fit()
        const dimsAfter = { rows: term.rows, cols: term.cols }
        console.log('[terminal] fit.fit() called, new rows/cols: ' + dimsAfter.rows + '/' + dimsAfter.cols + ' (was ' + dimsBefore.rows + '/' + dimsBefore.cols + ') container=' + host.clientWidth + 'x' + host.clientHeight)
      } catch (err) {
        console.log('[terminal] fit.fit() error:', err)
        return
      }

      // Sanity floor — skip transient 0-size frames
      if (term.rows < 2 || term.cols < 2) {
        console.log('[terminal] skipping resize, sanity floor: term=' + term.cols + 'x' + term.rows)
        return
      }

      const id = sessionIdRef.current
      if (!id) return

      // If EITHER dimension changed (grow OR shrink), resize the PTY
      if (term.rows !== lastRows || term.cols !== lastCols) {
        lastRows = term.rows
        lastCols = term.cols
        lastSentSize = { cols: term.cols, rows: term.rows }
        console.log('[terminal] resizing PTY to: ' + term.cols + 'x' + term.rows)
        void terminalApi.resize(id, { cols: term.cols, rows: term.rows })
      }
    }

    // ResizeObserver — fires on ANY size change (grow or shrink)
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return
      requestAnimationFrame(() => {
        if (!disposed) fitAndResize()
      })
    })
    resizeObserver.observe(host)
    cleanup.push(() => resizeObserver.disconnect())

    // Data handler
    const dataDisposable = term.onData(data => {
      const id = sessionIdRef.current
      if (id) void terminalApi.write(id, data)
    })
    cleanup.push(() => dataDisposable.dispose())

    // Selection handler
    const selectionDisposable = term.onSelectionChange(() => {
      const next = term.getSelection()
      selectionRef.current = next
      selectionLabelRef.current = next.trim() ? terminalSelectionLabel(term, shellNameRef.current, next) : ''
      setSelection(next)
      setSelectionStyle(next.trim() ? terminalSelectionAnchor(host) : null)
    })
    cleanup.push(() => selectionDisposable.dispose())

    // Key handler
    term.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown') return true
      if (isAddSelectionShortcut(event) && term.hasSelection()) {
        event.preventDefault()
        addSelectionToChat()
        return false
      }
      return true
    })

    // Start PTY session after container is ready
    const startPty = () => {
      if (disposed) return
      console.log('[terminal] startPty check:', { clientWidth: host.clientWidth, clientHeight: host.clientHeight })
      if (host.clientWidth <= 0 || host.clientHeight < 50) {
        console.log('[terminal] container too small (' + host.clientWidth + 'x' + host.clientHeight + '), retrying...')
        const t = setTimeout(startPty, 100)
        cleanup.push(() => clearTimeout(t))
        return
      }

      try {
        fit.fit()
        console.log('[terminal] startPty fit.fit() done, term=' + term.cols + 'x' + term.rows)
      } catch (err) {
        console.log('[terminal] fit.fit() failed:', err)
        const t = setTimeout(startPty, 50)
        cleanup.push(() => clearTimeout(t))
        return
      }

      let cols = term.cols
      let rows = term.rows
      console.log('[terminal] after fit:', { cols, rows, termCols: term.cols, termRows: term.rows, hostW: host.clientWidth, hostH: host.clientHeight })
      if (cols <= 0 || rows <= 0) {
        cols = Math.max(80, Math.floor(host.clientWidth / 7))
        rows = Math.max(8, Math.floor(host.clientHeight / 12.32))
      }
      rows = Math.max(rows, 8)
      cols = Math.max(cols, 80)

      console.log('[terminal] starting PTY:', { cols, cwd, rows, shell })
      void terminalApi
        .start({ cols, cwd, rows, shell })
        .then(session => {
          console.log('[terminal] PTY started:', { sessionId: session.id, shell: session.shell })
          if (disposed) {
            void terminalApi.dispose(session.id)
            return
          }

          sessionIdRef.current = session.id
          lastSentSize = { cols: term.cols, rows: term.rows }
          lastRows = term.rows
          lastCols = term.cols
          shellNameRef.current = session.shell || 'shell'
          setShellName(session.shell || 'shell')
          setStatus('open')

          if (term.hasSelection()) {
            const currentSelection = term.getSelection()
            selectionRef.current = currentSelection
            selectionLabelRef.current = terminalSelectionLabel(term, shellNameRef.current, currentSelection)
          } else {
            selectionRef.current = ''
            selectionLabelRef.current = ''
          }

          let wrotePromptContent = false

          cleanup.push(
            terminalApi.onData(session.id, data => {
              if (wrotePromptContent) {
                term.write(data)
                return
              }
              if (isStartupSpacer(data)) return
              const next = stripInitialPromptGap(data)
              if (next) {
                wrotePromptContent = true
                term.write(next)
              }
            }),
            terminalApi.onExit(session.id, sessionExit => {
              setStatus('closed')
              term.write(`\r\n[terminal exited${sessionExit.signal ? `: ${sessionExit.signal}` : sessionExit.code !== null ? `: ${sessionExit.code}` : ''}]\r\n`)
            })
          )
        })
        .catch(error => {
          console.error('[terminal] PTY start failed:', error)
          setStatus('closed')
          term.write(`Terminal failed to start: ${error instanceof Error ? error.message : String(error)}\r\n`)
        })
    }

    // Delay start to ensure DOM layout is complete
    const tryStart = (attempt = 0) => {
      if (disposed) return
      if (host.clientWidth > 0 && host.clientHeight > 50) {
        startPty()
      } else if (attempt < 10) {
        const t = setTimeout(() => tryStart(attempt + 1), 100)
        cleanup.push(() => clearTimeout(t))
      } else {
        startPty()
      }
    }
    const startTimer = setTimeout(tryStart, 200)
    cleanup.push(() => clearTimeout(startTimer))

    term.focus()

    return () => {
      disposed = true
      cleanup.forEach(run => run())
      const id = sessionIdRef.current
      sessionIdRef.current = null
      if (id) void terminalApi.dispose(id)
      term.dispose()
      termRef.current = null
      shellNameRef.current = 'shell'
      selectionRef.current = ''
      selectionLabelRef.current = ''
    }
  }, [shell, cwd])  // <-- single dependency array, handles both shell switch AND cwd change

  // Live theme-switch update: when the theme context changes, re-resolve the background
  // color from the container and update xterm.js theme options (no PTY restart needed).
  // xterm.js supports updating .options.theme at runtime — it triggers a full re-render.
  useEffect(() => {
    const term = termRef.current
    if (!term || !hostRef.current?.parentElement) return

    const newBg = resolveThemeBackground(hostRef.current.parentElement)
    const newFg = themeCtx.theme.colors.foreground || '#839496'
    console.log('[terminal] live theme update:', newBg, 'mode:', themeCtx.resolvedMode)

    term.options.theme = {
      ...term.options.theme,
      background: newBg,
      foreground: newFg,
      cursor: newFg,
      cursorAccent: newBg
    }
  }, [themeCtx.resolvedMode, themeCtx.themeName])

  return {
    addSelectionToChat,
    hostRef,
    selection,
    selectionStyle,
    shellName,
    status
  }
}
