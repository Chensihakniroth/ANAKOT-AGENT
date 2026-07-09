/**
 * VS Code Marketplace theme fetcher.
 *
 * Uses the VS Code Gallery API to search for extension results, then filters
 * for themes and maps them into a digestible shape for the theme browser UI.
 */

import type { DesktopTheme } from './types'

export interface VscodeThemeEntry {
  /** Extension identifier (publisher.extension) */
  extensionId: string
  /** Display name */
  name: string
  /** Publisher display name */
  publisher: string
  /** Short description */
  description: string
  /** Version string (e.g. "1.2.3") */
  version: string
  /** URL to the extension's marketplace page */
  marketplaceUrl: string
  /** Direct URL to the latest VSIX (for download / install) */
  downloadUrl: string
  /** Installs count (approximate) */
  installs: number
  /** Rating (0–5) */
  rating: number
  /** Number of ratings */
  ratingCount: number
  /** Icon URL (usually 128×128) */
  iconUrl?: string
  /** Preview image URL (screenshot of the theme) */
  previewUrl?: string
  /** Tags (e.g. "dark", "light", "color-theme") */
  tags: string[]
  /** Is this a dark theme? */
  isDark: boolean
  /** Repository URL if available */
  repositoryUrl?: string
}

const VSCODE_GALLERY_API = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'

const QUERY_BODY = {
  filters: [
    {
      criteria: [
        { filterType: 8, value: 'Microsoft.VisualStudio.Code' },            // Target
        { filterType: 12, value: '48' },                                      // Page size (was 4096 — throttled to avoid lag)
        { filterType: 10, value: 'category:"themes"' },                      // Category
        { filterType: 5, value: 'Featured' }                                 // Sort by featured
      ],
      direction: 2
    }
  ],
  flags: 0x2 | 0x80 | 0x100 | 0x200 | 0x400 | 0x1000  // IncludeFiles, IncludeVersionProperties, IncludeCategory, IncludeInstallationTargets, IncludeAssetUri, IncludeStatistics
}

const FLAGS_DETAILED = 0x2 | 0x80 | 0x100 | 0x200 | 0x400 | 0x1000 | 0x2000

interface GalleryExtension {
  publisher: { publisherName: string; displayName: string }
  extensionName: string
  displayName: string
  versions: Array<{
    version: string
    files: Array<{ assetType: string; source: string }>
    properties: Array<{ key: string; value: string }>
  }>
  shortDescription: string
  statistics: Array<{ statisticName: string; value: number }>
  categories: string[]
  tags: string[]
  galleryResourceUrl?: string
}

function findAsset(assets: Array<{ assetType: string; source: string }>, type: string): string | undefined {
  return assets.find(a => a.assetType === type)?.source
}

function findStat(stats: Array<{ statisticName: string; value: number }>, name: string): number {
  return stats.find(s => s.statisticName === name)?.value ?? 0
}

function findProperty(props: Array<{ key: string; value: string }>, key: string): string | undefined {
  return props.find(p => p.key === key)?.value
}

function mapExtension(ext: GalleryExtension): VscodeThemeEntry | null {
  const latestVersion = ext.versions?.[0]
  if (!latestVersion) return null

  const tags = [...(ext.tags ?? [])]
  const cats = [...(ext.categories ?? [])]
  const allTags = [...new Set([...tags, ...cats])]
  const isDark = allTags.some(t => t.toLowerCase().includes('dark'))

  const iconUrl = ext.galleryResourceUrl || findAsset(latestVersion.files, 'Microsoft.VisualStudio.Services.Icons.Default')
  const previewUrl = findAsset(latestVersion.files, 'Microsoft.VisualStudio.Services.Icons.Preview')

  return {
    extensionId: `${ext.publisher.publisherName}.${ext.extensionName}`,
    name: ext.displayName || ext.extensionName,
    publisher: ext.publisher.displayName || ext.publisher.publisherName,
    description: ext.shortDescription || '',
    version: latestVersion.version,
    marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${ext.publisher.publisherName}.${ext.extensionName}`,
    downloadUrl: findAsset(latestVersion.files, 'Microsoft.VisualStudio.Services.VSIXPackage') ?? '',
    installs: findStat(ext.statistics, 'install'),
    rating: findStat(ext.statistics, 'averagerating'),
    ratingCount: findStat(ext.statistics, 'ratingcount'),
    iconUrl,
    previewUrl,
    tags: allTags,
    isDark,
    repositoryUrl: findProperty(latestVersion.properties, 'Microsoft.VisualStudio.Services.Links.Source')
  }
}

/**
 * Search VS Code Marketplace for themes.
 * Uses the official Gallery API with a "themes" category filter.
 */
export async function fetchVscodeThemes(search?: string): Promise<VscodeThemeEntry[]> {
  const body = search?.trim()
    ? {
        filters: [
          {
            criteria: [
              { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
              { filterType: 10, value: 'category:"themes"' },
              { filterType: 1, value: search.trim() }
            ],
            direction: 2
          }
        ],
        flags: FLAGS_DETAILED
      }
    : QUERY_BODY

  try {
    const res = await fetch(VSCODE_GALLERY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=3.0-preview.1'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      console.warn('[vscode-marketplace] API returned', res.status)
      return []
    }

    const data: { results?: Array<{ extensions?: GalleryExtension[] }> } = await res.json()
    const extensions = data.results?.[0]?.extensions ?? []

    return extensions
      .map(mapExtension)
      .filter((e): e is VscodeThemeEntry => e !== null)
  } catch (err) {
    console.warn('[vscode-marketplace] fetch failed:', err)
    return []
  }
}

/**
 * Parse VS Code theme JSON from an extension's extracted theme file into a
 * simple CSS variable map that we can apply to the :root element.
 */
export function parseVscodeThemeToCss(themeJson: Record<string, unknown>, isDark: boolean): Record<string, string> {
  const colors = (themeJson.colors as Record<string, string>) ?? {}
  const tokenColors = (themeJson.tokenColors ?? themeJson.settings) as Array<{ scope?: string | string[]; settings?: Record<string, string> }> | undefined

  // Map VS Code theme colors to our CSS variables
  const css: Record<string, string> = {
    '--vscode-editor-background': colors['editor.background'] ?? (isDark ? '#1e1e1e' : '#ffffff'),
    '--vscode-editor-foreground': colors['editor.foreground'] ?? (isDark ? '#d4d4d4' : '#333333'),
    '--vscode-editor-lineHighlightBackground': colors['editor.lineHighlightBackground'] ?? 'transparent',
    '--vscode-editor-selectionBackground': colors['editor.selectionBackground'] ?? (isDark ? '#264f78' : '#add6ff'),
    '--vscode-editorCursor-foreground': colors['editorCursor.foreground'] ?? (isDark ? '#aeafad' : '#000000'),
    '--vscode-terminal-background': colors['terminal.background'] ?? colors['editor.background'] ?? (isDark ? '#1e1e1e' : '#ffffff'),
    '--vscode-terminal-foreground': colors['terminal.foreground'] ?? colors['editor.foreground'] ?? (isDark ? '#d4d4d4' : '#333333'),
    '--vscode-terminal-ansiBlack': colors['terminal.ansiBlack'] ?? '#000000',
    '--vscode-terminal-ansiRed': colors['terminal.ansiRed'] ?? '#cd3131',
    '--vscode-terminal-ansiGreen': colors['terminal.ansiGreen'] ?? '#0dbc79',
    '--vscode-terminal-ansiYellow': colors['terminal.ansiYellow'] ?? '#e5e510',
    '--vscode-terminal-ansiBlue': colors['terminal.ansiBlue'] ?? '#2472c8',
    '--vscode-terminal-ansiMagenta': colors['terminal.ansiMagenta'] ?? '#bc3fbc',
    '--vscode-terminal-ansiCyan': colors['terminal.ansiCyan'] ?? '#11b8bd',
    '--vscode-terminal-ansiWhite': colors['terminal.ansiWhite'] ?? '#e5e5e5',
    '--vscode-terminal-ansiBrightBlack': colors['terminal.ansiBrightBlack'] ?? '#666666',
    '--vscode-terminal-ansiBrightRed': colors['terminal.ansiBrightRed'] ?? '#f14c4c',
    '--vscode-terminal-ansiBrightGreen': colors['terminal.ansiBrightGreen'] ?? '#23d18b',
    '--vscode-terminal-ansiBrightYellow': colors['terminal.ansiBrightYellow'] ?? '#f5f543',
    '--vscode-terminal-ansiBrightBlue': colors['terminal.ansiBrightBlue'] ?? '#3b8eea',
    '--vscode-terminal-ansiBrightMagenta': colors['terminal.ansiBrightMagenta'] ?? '#d670d6',
    '--vscode-terminal-ansiBrightCyan': colors['terminal.ansiBrightCyan'] ?? '#29b8db',
    '--vscode-terminal-ansiBrightWhite': colors['terminal.ansiBrightWhite'] ?? '#ffffff',
    '--vscode-sideBar-background': colors['sideBar.background'] ?? colors['editor.background'] ?? (isDark ? '#252526' : '#f3f3f3'),
    '--vscode-sideBar-foreground': colors['sideBar.foreground'] ?? colors['editor.foreground'] ?? (isDark ? '#cccccc' : '#333333'),
    '--vscode-activityBar-background': colors['activityBar.background'] ?? (isDark ? '#2d2d2d' : '#2c2c2c'),
    '--vscode-activityBar-foreground': colors['activityBar.foreground'] ?? '#ffffff',
    '--vscode-tab-activeBackground': colors['tab.activeBackground'] ?? (isDark ? '#1e1e1e' : '#ffffff'),
    '--vscode-tab-activeForeground': colors['tab.activeForeground'] ?? (isDark ? '#ffffff' : '#333333'),
    '--vscode-tab-inactiveBackground': colors['tab.inactiveBackground'] ?? (isDark ? '#2d2d2d' : '#ececec'),
    '--vscode-tab-inactiveForeground': colors['tab.inactiveForeground'] ?? (isDark ? '#969696' : '#666666'),
  }

  // Parse token colors for syntax highlighting base
  if (tokenColors && tokenColors.length > 0) {
    const defaultToken = tokenColors.find(t => !t.scope || t.scope === '')
    if (defaultToken?.settings?.foreground) {
      css['--vscode-syntax-default'] = defaultToken.settings.foreground
    }
  }

  return css
}

/**
 * Convert a VS Code theme entry + raw theme JSON to a DesktopTheme that can
 * be registered as a custom theme and appear in the built-in theme list.
 */
export function vscodeThemeToDesktopTheme(
  entry: VscodeThemeEntry,
  themeJson: Record<string, unknown>,
): DesktopTheme {
  const colors = (themeJson.colors as Record<string, string>) ?? {}
  const isDark = entry.isDark

  const name = `vsc:${entry.extensionId.replace(/\./g, '-')}`
  const label = entry.name
  const description = `${entry.publisher} • ${entry.description ? entry.description.slice(0, 80) : 'VS Code Marketplace theme'}`

  const bg = colors['editor.background'] ?? (isDark ? '#1e1e1e' : '#ffffff')
  const fg = colors['editor.foreground'] ?? (isDark ? '#d4d4d4' : '#333333')
  const selectionBg = colors['editor.selectionBackground'] ?? (isDark ? '#264f78' : '#add6ff')
  const lineHighlight = colors['editor.lineHighlightBackground'] ?? 'transparent'
  const cursorColor = colors['editorCursor.foreground'] ?? (isDark ? '#aeafad' : '#000000')
  const sideBarBg = colors['sideBar.background'] ?? colors['activityBar.background'] ?? bg
  const sideBarFg = colors['sideBar.foreground'] ?? fg
  const sideBarBorder = colors['sideBar.border'] ?? colors['activityBar.border'] ?? 'transparent'
  const activityBarBg = colors['activityBar.background'] ?? (isDark ? '#2d2d2d' : '#2c2c2c')
  const activityBarFg = colors['activityBar.foreground'] ?? '#ffffff'
  const tabActiveBg = colors['tab.activeBackground'] ?? bg
  const tabActiveFg = colors['tab.activeForeground'] ?? fg
  const tabInactiveBg = colors['tab.inactiveBackground'] ?? (isDark ? '#2d2d2d' : '#ececec')
  const tabInactiveFg = colors['tab.inactiveForeground'] ?? (isDark ? '#969696' : '#666666')
  const inputBg = colors['input.background'] ?? (isDark ? '#3c3c3c' : '#ffffff')
  const inputBorder = colors['input.border'] ?? (isDark ? '#555555' : '#cccccc')
  const buttonBg = colors['button.background'] ?? '#0078d4'
  const buttonFg = colors['button.foreground'] ?? '#ffffff'
  const badgeBg = colors['badge.background'] ?? buttonBg
  const badgeFg = colors['badge.foreground'] ?? buttonFg
  const focusColor = colors['focusBorder'] ?? buttonBg
  const listHoverBg = colors['list.hoverBackground'] ?? (isDark ? '#2a2d2e' : '#e8e8e8')
  const listActiveBg = colors['list.activeSelectionBackground'] ?? (isDark ? '#094771' : '#0060c0')
  const listActiveFg = colors['list.activeSelectionForeground'] ?? '#ffffff'
  const scrollbar = colors['scrollbarSlider.background'] ?? (isDark ? '#424242' : '#c0c0c0')
  const terminalBg = colors['terminal.background'] ?? bg
  const terminalFg = colors['terminal.foreground'] ?? fg

  return {
    name,
    label,
    description,
    colors: {
      background: bg,
      foreground: fg,
      card: tabActiveBg,
      cardForeground: tabActiveFg,
      muted: listHoverBg,
      mutedForeground: tabInactiveFg,
      popover: tabActiveBg,
      popoverForeground: tabActiveFg,
      primary: buttonBg,
      primaryForeground: buttonFg,
      secondary: tabInactiveBg,
      secondaryForeground: tabInactiveFg,
      accent: listActiveBg,
      accentForeground: listActiveFg,
      border: sideBarBorder,
      input: inputBorder,
      ring: focusColor,
      midground: focusColor,
      composerRing: focusColor,
      destructive: '#c72e4d',
      destructiveForeground: '#ffffff',
      sidebarBackground: sideBarBg,
      sidebarBorder: sideBarBorder,
      userBubble: listHoverBg,
      userBubbleBorder: sideBarBorder,
    },
    darkColors: isDark
      ? undefined
      : undefined, // light themes don't get a dark variant
    typography: {
      fontSans:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      fontMono:
        '"Cascadia Code", "JetBrains Mono", "Fira Code", ui-monospace, Menlo, Monaco, Consolas, monospace',
    },
  }
}

/**
 * Apply VS Code theme CSS variables to document root.
 */
export function applyVscodeTheme(cssVars: Record<string, string>) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value)
  }
}

// ─── ZIP parser (minimal, no dependencies) ──────────────────────────────────

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function findEndOfCentralDirectory(data: ArrayBuffer): { offset: number; commentLength: number } | null {
  const view = new Uint8Array(data)
  // Search backwards for the EOCD signature 0x06054b50
  for (let i = data.byteLength - 22; i >= 0; i--) {
    if (view[i] === 0x50 && view[i + 1] === 0x4b && view[i + 2] === 0x05 && view[i + 3] === 0x06) {
      const dv = new DataView(data, i)
      return {
        offset: i,
        commentLength: readU16(dv, 20)
      }
    }
  }
  return null
}

interface ZipEntry {
  fileName: string
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function readCentralDirectory(data: ArrayBuffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(data)
  if (!eocd) return []

  const dv = new DataView(data, eocd.offset)
  const cdOffset = readU32(dv, 16)
  const cdEntries = readU16(dv, 10) // total entries on this disk
  const entries: ZipEntry[] = []
  const cdEnd = data.byteLength - eocd.commentLength
  let cursor = cdOffset

  for (let i = 0; i < cdEntries; i++) {
    if (cursor + 46 > cdEnd) break

    const cdDv = new DataView(data, cursor)
    const sig = cdDv.getUint32(0, true)
    if (sig !== 0x02014b50) break // PK\x01\x02

    const fileNameLen = readU16(cdDv, 28)
    const extraLen = readU16(cdDv, 30)
    const commentLen = readU16(cdDv, 32)
    const entrySize = 46 + fileNameLen + extraLen + commentLen

    entries.push({
      fileName: new TextDecoder().decode(new Uint8Array(data, cursor + 46, fileNameLen)),
      compressionMethod: readU16(cdDv, 10),
      compressedSize: readU32(cdDv, 20),
      uncompressedSize: readU32(cdDv, 24),
      localHeaderOffset: readU32(cdDv, 42)
    })

    cursor += entrySize
  }

  return entries
}

/**
 * Check if a file path looks like a VS Code theme JSON file.
 */
function isThemeFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  // Be permissive — the actual content validation (checking for `colors`/`tokenColors`)
  // happens after JSON.parse at line 481. Accept any .json outside node_modules.
  return lower.endsWith('.json') && !lower.includes('node_modules')
}

/**
 * Decompress deflate-raw data using the browser's CompressionStream API.
 */
async function inflateData(compressed: Uint8Array): Promise<Uint8Array> {
  // Try deflate-raw first (standard ZIP deflate), fall back to gzip
  for (const format of ['deflate-raw', 'gzip'] as const) {
    try {
      const blob = new Blob([compressed as unknown as BlobPart])
      const body = new Response(blob).body
      if (!body) continue
      const stream = body.pipeThrough(new DecompressionStream(format))
      const result = await new Response(stream).arrayBuffer()
      return new Uint8Array(result)
    } catch {
      continue
    }
  }
  // If all decompression methods fail, return the raw data — the caller
  // will skip it when JSON.parse fails
  return compressed
}

/**
 * Strip JSONC-style comments from a JSON string so it can be parsed with JSON.parse.
 * Handles // and /* * / comments, respecting strings so comments inside strings are kept.
 */
function stripJsonComments(text: string): string {
  let result = ''
  let i = 0
  const len = text.length
  let inString = false
  let stringChar = ''

  while (i < len) {
    const ch = text[i]
    const next = i + 1 < len ? text[i + 1] : ''

    // Track string boundaries so we don't strip comments inside strings
    if (!inString) {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true
        stringChar = ch
        result += ch
        i++
        continue
      }
      // Single-line comment
      if (ch === '/' && next === '/') {
        while (i < len && text[i] !== '\n') i++
        // Keep the newline
        if (i < len) { result += '\n'; i++ }
        continue
      }
      // Multi-line comment
      if (ch === '/' && next === '*') {
        i += 2
        while (i < len && !(text[i] === '*' && i + 1 < len && text[i + 1] === '/')) i++
        if (i < len) i += 2 // skip */
        continue
      }
    } else {
      // Inside string — track escape sequences
      if (ch === '\\') {
        result += ch + (i + 1 < len ? text[i + 1] : '')
        i += 2
        continue
      }
      if (ch === stringChar) {
        inString = false
      }
    }

    result += ch
    i++
  }

  return result
}

/**
 * Extract file data from a ZIP archive for a given entry.
 */
async function extractEntryData(data: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array | null> {
  const dv = new DataView(data, entry.localHeaderOffset)
  const sig = dv.getUint32(0, true)
  if (sig !== 0x04034b50) return null // not a valid local header

  const fileNameLen = readU16(dv, 26)
  const extraLen = readU16(dv, 28)
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLen + extraLen

  if (dataOffset + entry.compressedSize > data.byteLength) return null

  const raw = new Uint8Array(data, dataOffset, entry.compressedSize)

  if (entry.compressionMethod === 0) {
    // Stored (uncompressed)
    return raw
  } else if (entry.compressionMethod === 8) {
    // Deflated
    return await inflateData(raw)
  }

  return null // unsupported compression
}

/**
 * Download a VSIX from the marketplace, extract the first theme JSON file,
 * parse it to CSS variables, and apply it to the document root.
 *
 * Returns an object with the theme file name and the parsed JSON on success,
 * or null if no theme could be installed.
 */
export async function installVscodeTheme(
  themeEntry: VscodeThemeEntry,
): Promise<{ fileName: string; themeJson: Record<string, unknown> } | null> {
  try {
    if (!themeEntry.downloadUrl) {
      console.warn('[vscode-marketplace] No download URL for theme:', themeEntry.name)
      return null
    }

    const response = await fetch(themeEntry.downloadUrl)
    if (!response.ok) {
      console.warn('[vscode-marketplace] Failed to download VSIX:', response.status)
      return null
    }

    const vsixData = await response.arrayBuffer()
    const entries = readCentralDirectory(vsixData)

    // Find the first theme JSON file
    const themeEntries = entries.filter(e => isThemeFile(e.fileName))
    if (themeEntries.length === 0) {
      console.warn('[vscode-marketplace] No theme JSON found in VSIX (entries:', entries.length, ', filenames:', entries.map(e => e.fileName).slice(0, 10).join(', ') + ')')
      return null
    }

    for (const entry of themeEntries) {
      const fileData = await extractEntryData(vsixData, entry)
      if (!fileData) continue

      try {
        const jsonText = new TextDecoder().decode(fileData)
        const cleaned = stripJsonComments(jsonText)
        const themeJson = JSON.parse(cleaned)

        // Skip if it doesn't look like a VS Code theme (must have "colors")
        if (!themeJson || typeof themeJson !== 'object' || !themeJson.colors) continue

        const cssVars = parseVscodeThemeToCss(themeJson, themeEntry.isDark)
        applyVscodeTheme(cssVars)
        return { fileName: entry.fileName, themeJson }
      } catch {
        // Try next file
        continue
      }
    }

    return null
  } catch (err) {
    console.warn('[vscode-marketplace] install failed:', err)
    return null
  }
}
