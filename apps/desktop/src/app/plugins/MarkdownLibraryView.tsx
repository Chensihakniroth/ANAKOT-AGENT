import {
  IconChevronDown as ChevronDownIcon,
  IconChevronRight as ChevronRightIcon,
  IconX as CloseIcon,
  IconFileText as FileTextIcon,
  IconRotateClockwise as RefreshIcon,
  IconSearch as SearchIcon,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps, ElementType, FC } from 'react'
import ShikiHighlighter from 'react-shiki'
import { Streamdown } from 'streamdown'

import { getAnakotConfigRecord } from '@/anakot'
import { getNested } from '@/app/settings/helpers'
import { cn } from '@/lib/utils'

interface NoteNode {
  id: string
  name: string
  path: string
  group: string
  size: number
}

// ---------------------------------------------------------------------------
// Markdown rendering — mirrors apps/desktop/src/app/chat/right-rail/preview-file.tsx
// so the library renders notes exactly like the file preview rail.
// ---------------------------------------------------------------------------
const SHIKI_THEME = { dark: 'github-dark-default', light: 'github-light-default' } as const

const MD_TAG_CLASSES = {
  h1: 'mb-3 mt-6 text-3xl font-bold leading-tight tracking-tight first:mt-0',
  h2: 'mb-2.5 mt-5 text-2xl font-semibold leading-snug tracking-tight first:mt-0',
  h3: 'mb-2 mt-4 text-xl font-semibold leading-snug first:mt-0',
  h4: 'mb-2 mt-3 text-base font-semibold leading-snug first:mt-0',
  p: 'mb-4 leading-relaxed text-foreground last:mb-0',
  ul: 'mb-4 list-disc pl-6 marker:text-muted-foreground/70 last:mb-0',
  ol: 'mb-4 list-decimal pl-6 marker:text-muted-foreground/70 last:mb-0',
  li: 'mt-1 leading-relaxed',
  blockquote: 'mb-4 border-l-2 border-border pl-3 text-muted-foreground italic last:mb-0',
  pre: 'mb-4 overflow-hidden rounded-lg border border-border bg-card font-mono text-xs leading-relaxed last:mb-0 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:bg-transparent! [&_pre]:p-3 [&_pre]:font-mono',
} as const

function tagged<T extends keyof typeof MD_TAG_CLASSES>(Tag: T) {
  const base = MD_TAG_CLASSES[Tag]

  const Component = (({ className, ...rest }: ComponentProps<T>) => {
    const Element = Tag as ElementType

    return <Element className={cn(base, className)} {...rest} />
  }) as FC<ComponentProps<T>>

  Component.displayName = `Md.${Tag}`

  return Component
}

function MarkdownCode({ className, children, ...props }: ComponentProps<'code'>) {
  const language = /language-([^\s]+)/.exec(className || '')?.[1]

  if (!language) {
    return (
      <code
        className={cn(
          'rounded bg-muted px-1 py-0.5 font-mono text-[0.86em] text-pink-700 dark:text-pink-300',
          className,
        )}
        {...props}
      >
        {children}
      </code>
    )
  }

  return (
    <ShikiHighlighter
      addDefaultStyles={false}
      as="div"
      defaultColor="light-dark()"
      delay={80}
      language={language}
      showLanguage={false}
      theme={SHIKI_THEME}
    >
      {String(children).replace(/\n$/, '')}
    </ShikiHighlighter>
  )
}

const MARKDOWN_COMPONENTS = {
  h1: tagged('h1'),
  h2: tagged('h2'),
  h3: tagged('h3'),
  h4: tagged('h4'),
  p: tagged('p'),
  ul: tagged('ul'),
  ol: tagged('ol'),
  li: tagged('li'),
  blockquote: tagged('blockquote'),
  pre: tagged('pre'),
  code: MarkdownCode,
}

function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="preview-markdown mx-auto max-w-3xl px-4 py-3 text-sm text-foreground">
      <Streamdown components={MARKDOWN_COMPONENTS} controls={false} mode="static" parseIncompleteMarkdown={false}>
        {text}
      </Streamdown>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
const GROUP_COLORS: Record<string, string> = {
  'Anakot Agent': '#00f0ff',
  'nile training': '#ff2975',
  'Daily Notes': '#f0e100',
  root: '#b829f0',
}

const FALLBACK_COLORS = ['#00f0ff', '#ff2975', '#b829f0', '#f0e100', '#00ff87', '#ff6b35', '#39ff14', '#ff00ff']

const groupColor = (g: string) =>
  GROUP_COLORS[g] || FALLBACK_COLORS[g.charCodeAt(0) % FALLBACK_COLORS.length]

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--color-text-tertiary)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      {label && <span className="text-xs font-mono tracking-widest">{label}</span>}
    </div>
  )
}

export function MarkdownLibraryView({ onClose }: { onClose?: () => void }) {
  const [notes, setNotes] = useState<NoteNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultPath, setVaultPath] = useState<string | null>(null)

  const [selected, setSelected] = useState<NoteNode | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const loadVault = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Read the vault path from the live app config — the same source the
      // Settings UI writes to (obsidian.vault_path). The getObsidianVaultPath
      // IPC only reads a hardcoded ~/.anakot/config.yaml path, which diverges
      // from where the app actually persists config, so we prefer the record.
      const config = await getAnakotConfigRecord()
      let root = String(getNested(config, 'obsidian.vault_path') ?? '').trim()

      if (!root) {
        try {
          const pathRes = await window.anakotDesktop.getObsidianVaultPath()
          root = pathRes?.ok ? String(pathRes.path ?? '').trim() : ''
        } catch {
          // ignore — fall through to the "not configured" error below
        }
      }

      if (!root) {
        setVaultPath('')
        setError('No Obsidian vault path configured. Set it in Settings → Obsidian.')
        setNotes([])
        setLoading(false)

        return
      }

      setVaultPath(root)
      const res = await window.anakotDesktop.scanObsidianVault(root)

      if (res?.ok) {
        setNotes(res.graph.nodes)
        setError(null)
      } else {
        setError(res?.error || 'Failed to scan vault')
        setNotes([])
      }
    } catch (e) {
      setError(String(e))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVault()
  }, [loadVault])

  const groups = useMemo(() => {
    const map = new Map<string, NoteNode[]>()

    for (const n of notes) {
      const arr = map.get(n.group) ?? []
      arr.push(n)
      map.set(n.group, arr)
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [notes])

  const matchesSearch = useCallback(
    (n: NoteNode) => {
      const q = search.trim().toLowerCase()

      if (!q) {return true}

      return n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)
    },
    [search],
  )

  const filteredGroups = useMemo(
    () => groups.map(([g, ns]) => [g, ns.filter(matchesSearch)] as [string, NoteNode[]]).filter(([, ns]) => ns.length > 0),
    [groups, matchesSearch],
  )

  const totalVisible = useMemo(() => filteredGroups.reduce((acc, [, ns]) => acc + ns.length, 0), [filteredGroups])

  const loadContent = useCallback(async (note: NoteNode) => {
    setContentLoading(true)
    setContentError(null)
    setContent(null)

    try {
      const res = await window.anakotDesktop.readFileText(note.path)

      if (res?.binary) {
        setContentError('This file looks binary — it cannot be previewed as markdown.')
        setContent(null)
      } else {
        setContent(res?.text ?? '')
      }
    } catch (e) {
      setContentError(String(e))
    } finally {
      setContentLoading(false)
    }
  }, [])

  const handleSelect = useCallback(
    (note: NoteNode) => {
      setSelected(note)
      void loadContent(note)
    },
    [loadContent],
  )

  const toggleCollapse = useCallback((group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)

      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }

      return next
    })
  }, [])

  // Escape clears the current selection.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {setSelected(null)}
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-full w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Sidebar: searchable, grouped note list */}
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-3">
          <FileTextIcon className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium">Markdown Library</span>
          {onClose && (
            <button
              className="ml-auto rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              onClick={onClose}
              title="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]/60 outline-none transition-colors focus:border-[var(--color-accent)]/50"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              value={search}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading && (
            <div className="py-10">
              <Spinner label="SCANNING VAULT…" />
            </div>
          )}

          {!loading && error && notes.length === 0 && (
            <div className="px-2 py-10 text-center">
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
              <button
                className="mt-4 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-mono tracking-wider transition-colors hover:bg-[var(--color-bg-tertiary)]"
                onClick={() => void loadVault()}
              >
                RETRY
              </button>
            </div>
          )}

          {!loading && !error && filteredGroups.length === 0 && (
            <div className="px-2 py-10 text-center text-xs text-[var(--color-text-tertiary)]">
              {notes.length === 0 ? 'No notes found in vault.' : 'No notes match your search.'}
            </div>
          )}

          {!loading &&
            filteredGroups.map(([group, groupNotes]) => {
              const isCollapsed = collapsed.has(group)

              return (
                <div className="mb-1" key={group}>
                  <button
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                    onClick={() => toggleCollapse(group)}
                  >
                    {isCollapsed ? <ChevronRightIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: groupColor(group) }} />
                    <span className="truncate">{group}</span>
                    <span className="ml-auto opacity-60">{groupNotes.length}</span>
                  </button>
                  {!isCollapsed &&
                    groupNotes.map((note) => (
                      <button
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-6 text-left text-xs transition-colors',
                          selected?.id === note.id
                            ? 'bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]',
                        )}
                        key={note.id}
                        onClick={() => handleSelect(note)}
                      >
                        <FileTextIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{note.name}</span>
                      </button>
                    ))}
                </div>
              )
            })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 text-[10px] font-mono text-[var(--color-text-tertiary)]">
          <span>{totalVisible} note{totalVisible === 1 ? '' : 's'}</span>
          <button
            className="flex items-center gap-1 transition-colors hover:text-[var(--color-text-primary)]"
            onClick={() => void loadVault()}
            title="Rescan vault"
          >
            <RefreshIcon className="h-3 w-3" /> Rescan
          </button>
        </div>
      </aside>

      {/* Main: rendered markdown */}
      <main className="h-full min-w-0 flex-1 overflow-y-auto">
        {!selected && !loading && !error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
            <FileTextIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a note to read it.</p>
          </div>
        )}

        {selected && (
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="mb-5 border-b border-[var(--color-border)] pb-4">
              <h1 className="text-xl font-bold leading-tight tracking-tight">{selected.name}</h1>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-[var(--color-text-tertiary)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: groupColor(selected.group) }} />
                {selected.group}
              </div>
              <div className="mt-1 truncate text-[10px] text-[var(--color-text-tertiary)]/70" title={selected.path}>
                {selected.path}
              </div>
            </div>

            {contentLoading && <Spinner label="LOADING…" />}
            {contentError && (
              <div className="rounded-lg border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
                {contentError}
              </div>
            )}
            {!contentLoading && !contentError && content !== null && <MarkdownPreview text={content} />}
          </div>
        )}
      </main>
    </div>
  )
}
