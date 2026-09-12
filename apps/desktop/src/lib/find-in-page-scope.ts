// Find-in-page scope — renderer-side find that scopes matches to the
// CURRENT chat view instead of the whole document.

// Background. Electron's webContents.findInPage searches the entire DOM.
// The desktop chat shell mounts every ever-active chat surface simultaneously,
// so a global search matches across every conversation. The user expects to
// search the chat they are reading when they press ⌘F.

import React from 'react'

import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import {
  closeFindBar,
  findNext,
  findPrevious,
  setFindQuery,
  updateFindResults,
  $findInPage,
} from '@/store/find-in-page'
import { cn } from '@/lib/utils'

const SCOPE_ATTR = 'data-find-root'
const HIGHLIGHT_CLASS = 'find-hit'
const ACTIVE_ATTR = 'data-find-active'

function resolveCurrentScope(): HTMLElement | null {
  return document.querySelector('[data-chat-surface]:not([data-pane-hidden])') as HTMLElement | null
}

function captureScope(): HTMLElement | null {
  const root = resolveCurrentScope()
  if (root) root.setAttribute(SCOPE_ATTR, '')
  return root
}

function clearHighlights(root: Element): void {
  const marks = root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

function highlightMatches(root: Element, query: string): HTMLElement[] {
  const marks: HTMLElement[] = []
  const lowerQuery = query.toLowerCase()
  if (!lowerQuery) return marks

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const parent = node.parentElement
    if (parent && (parent.closest(`mark.${HIGHLIGHT_CLASS}`) || parent.closest('[role="search"]'))) continue
    const text = node.nodeValue ?? ''
    const idx = text.toLowerCase().indexOf(lowerQuery)
    if (idx === -1) continue
    const before = document.createTextNode(text.slice(0, idx))
    const mark = document.createElement('mark')
    mark.className = HIGHLIGHT_CLASS
    mark.textContent = text.slice(idx, idx + query.length)
    const after = document.createTextNode(text.slice(idx + query.length))
    const parent2 = parent
    if (parent2) {
      const frag = document.createDocumentFragment()
      frag.appendChild(before); frag.appendChild(mark); frag.appendChild(after)
      parent2.replaceChild(frag, node)
      marks.push(mark)
    }
  }
  return marks
}

function clearActiveMarks(): void {
  document.querySelectorAll(`mark[${ACTIVE_ATTR}]`).forEach(el => el.removeAttribute(ACTIVE_ATTR))
}

function setActiveMark(mark: HTMLElement | null): void {
  clearActiveMarks()
  if (!mark) return
  mark.setAttribute(ACTIVE_ATTR, '')
  if (typeof mark.scrollIntoView === 'function') mark.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

interface ScopedFindOptions { forward: boolean; findNext: boolean }

function performScopedFind(root: Element, query: string, opts: ScopedFindOptions): { count: number; activeOrdinal: number } {
  if (!query) { clearHighlights(root); setActiveMark(null); return { count: 0, activeOrdinal: 0 } }
  const existing = [...root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)]
  const sameQuery = opts.findNext && existing.length > 0 && existing.every(m => m.textContent.toLowerCase() === query.toLowerCase())
  let marks = existing
  if (!sameQuery) { clearHighlights(root); marks = highlightMatches(root, query) }
  if (marks.length === 0) { setActiveMark(null); return { count: 0, activeOrdinal: 0 } }
  const prev = root.querySelector<HTMLElement>(`mark[${ACTIVE_ATTR}]`)
  let idx = 0
  if (prev) { const i = marks.indexOf(prev); if (i !== -1) idx = opts.forward ? (i + 1) % marks.length : (i - 1 + marks.length) % marks.length }
  else if (!opts.forward) idx = marks.length - 1
  setActiveMark(marks[idx] ?? null)
  return { count: marks.length, activeOrdinal: idx + 1 }
}

function releaseScope(): void {
  document.querySelectorAll(`[${SCOPE_ATTR}]`).forEach(root => {
    clearHighlights(root); root.removeAttribute(SCOPE_ATTR)
  })
  setActiveMark(null)
}

export function ScopedFindBar() {
  const state = useStore($findInPage)
  const scopeRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); closeFindBar(); return }
      if (!state.active) return
      if (e.key === 'Escape') { e.preventDefault(); setFindQuery(''); return }
      else if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? findPrevious() : findNext() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [state.active])

  useEffect(() => {
    if (!state.active) return
    inputRef.current?.focus(); inputRef.current?.select()
    const root = captureScope()
    scopeRef.current = root
    if (root && state.query) performScopedFind(root, state.query, { forward: true, findNext: false })
  }, [state.active])

  useEffect(() => {
    if (!state.active || !scopeRef.current || !state.query) return
    const root = scopeRef.current
    const result = performScopedFind(root, state.query, { forward: true, findNext: false })
    updateFindResults(result.activeOrdinal, result.count)
  }, [state.query])

  useEffect(() => {
    const detach = window.anakotDesktop?.onFoundInPage?.(() => {})
    return () => { window.anakotDesktop?.onFoundInPage?.(null as any) }
  }, [])

  if (!state.active) return null

  const open = cn('fixed right-4 top-3 z-50 flex items-center gap-1 rounded-md border border-border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur')
  const label = state.matchCount > 0 ? `${state.matchOrdinal}/${state.matchCount}` : '0/0'

  return React.createElement('div', { className: open, 'aria-label': 'Find in page' },
    React.createElement('input', {
      ref: inputRef,
      className: 'w-52 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFindQuery(e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? findPrevious() : findNext() } },
      placeholder: 'Find', value: state.query
    }),
    React.createElement('span', { className: 'min-w-10 text-center text-xs text-muted-foreground' }, label),
    React.createElement('button', { 'aria-label': 'Previous match', className: 'size-6 text-muted-foreground hover:text-foreground', onClick: findPrevious, type: 'button' }, '↑'),
    React.createElement('button', { 'aria-label': 'Next match', className: 'size-6 text-muted-foreground hover:text-foreground', onClick: findNext, type: 'button' }, '↓'),
    React.createElement('button', { 'aria-label': 'Close find bar', className: 'size-6 text-muted-foreground hover:text-foreground', onClick: () => { setFindQuery(''); releaseScope() }, type: 'button' }, '×')
  )
}
