import type { ITheme, Terminal } from '@xterm/xterm'
import type { CSSProperties } from 'react'

// Default VS Code Dark+ inspired terminal palette
export const VSCODE_TERMINAL_COLORS: ITheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f7855',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11b8bd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff'
}

/**
 * Build an ITheme palette that blends the current desktop theme with
 * VS Code Dark+ inspired ANSI colors. Reads CSS variables if they exist,
 * otherwise uses the imported defaults.
 */
export function buildTerminalTheme(
  bg: string,
  fg: string,
  overrides?: Partial<ITheme>
): ITheme {
  const root = typeof document !== 'undefined' ? document.documentElement : null

  const readVar = (varName: string, fallback: string): string => {
    if (!root) return fallback
    const val = getComputedStyle(root).getPropertyValue(varName).trim()
    return val || fallback
  }

  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: '#264f7855',
    black: readVar('--vscode-terminal-ansiBlack', VSCODE_TERMINAL_COLORS.black!),
    red: readVar('--vscode-terminal-ansiRed', VSCODE_TERMINAL_COLORS.red!),
    green: readVar('--vscode-terminal-ansiGreen', VSCODE_TERMINAL_COLORS.green!),
    yellow: readVar('--vscode-terminal-ansiYellow', VSCODE_TERMINAL_COLORS.yellow!),
    blue: readVar('--vscode-terminal-ansiBlue', VSCODE_TERMINAL_COLORS.blue!),
    magenta: readVar('--vscode-terminal-ansiMagenta', VSCODE_TERMINAL_COLORS.magenta!),
    cyan: readVar('--vscode-terminal-ansiCyan', VSCODE_TERMINAL_COLORS.cyan!),
    white: readVar('--vscode-terminal-ansiWhite', VSCODE_TERMINAL_COLORS.white!),
    brightBlack: readVar('--vscode-terminal-ansiBrightBlack', VSCODE_TERMINAL_COLORS.brightBlack!),
    brightRed: readVar('--vscode-terminal-ansiBrightRed', VSCODE_TERMINAL_COLORS.brightRed!),
    brightGreen: readVar('--vscode-terminal-ansiBrightGreen', VSCODE_TERMINAL_COLORS.brightGreen!),
    brightYellow: readVar('--vscode-terminal-ansiBrightYellow', VSCODE_TERMINAL_COLORS.brightYellow!),
    brightBlue: readVar('--vscode-terminal-ansiBrightBlue', VSCODE_TERMINAL_COLORS.brightBlue!),
    brightMagenta: readVar('--vscode-terminal-ansiBrightMagenta', VSCODE_TERMINAL_COLORS.brightMagenta!),
    brightCyan: readVar('--vscode-terminal-ansiBrightCyan', VSCODE_TERMINAL_COLORS.brightCyan!),
    brightWhite: readVar('--vscode-terminal-ansiBrightWhite', VSCODE_TERMINAL_COLORS.brightWhite!),
    ...overrides
  }
}

export const TERMINAL_BG = '#1e1e1e'

export const terminalTheme = (): ITheme => VSCODE_TERMINAL_COLORS

export const isMacPlatform = () => navigator.platform.toLowerCase().includes('mac')

export const addSelectionShortcutLabel = () => (isMacPlatform() ? '⌘L' : 'Ctrl+L')

export function isAddSelectionShortcut(event: KeyboardEvent) {
  const mod = isMacPlatform() ? event.metaKey : event.ctrlKey

  return mod && !event.shiftKey && event.key.toLowerCase() === 'l'
}

export function terminalSelectionLabel(term: Terminal, shellName: string, text: string) {
  const pos = term.getSelectionPosition()

  if (pos) {
    return pos.start.y === pos.end.y ? `${shellName}:${pos.start.y}` : `${shellName}:${pos.start.y}-${pos.end.y}`
  }

  const lines = Math.max(1, text.trim().split(/\r?\n/).length)

  return `${shellName}:${lines} line${lines === 1 ? '' : 's'}`
}

export function terminalSelectionAnchor(host: HTMLDivElement): CSSProperties | null {
  const rect = Array.from(host.querySelectorAll<HTMLElement>('.xterm-selection div'))
    .map(node => node.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0)
    .at(-1)

  if (!rect) {
    return null
  }

  const hostRect = host.getBoundingClientRect()
  const buttonWidth = 128
  const left = Math.min(Math.max(rect.left - hostRect.left, 8), Math.max(8, host.clientWidth - buttonWidth - 8))
  const top = Math.min(Math.max(rect.bottom - hostRect.top + 4, 8), Math.max(8, host.clientHeight - 34))

  return { left, top }
}
