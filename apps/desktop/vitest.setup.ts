import React from 'react'
import { vi } from 'vitest'

// =============================================================================
// Vitest jsdom environment polyfills
// -----------------------------------------------------------------------------
// jsdom does not implement several browser APIs the app (and libraries like
// @tanstack/virtual) rely on. Without these, component tests crash with
// "requestAnimationFrame is not a function" or throw on ResizeObserver. They
// are stubbed with no-op / setTimeout-based implementations sufficient for
// unit tests (we are not measuring animation or layout timing here).
// =============================================================================

// requestAnimationFrame / cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number): void =>
    clearTimeout(id)) as typeof cancelAnimationFrame
}

// ResizeObserver — used by virtualizers and responsive components
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

// matchMedia — used by theme / responsive logic
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

// IntersectionObserver — used by some lazy / scroll-reveal components
if (typeof globalThis.IntersectionObserver !== 'function') {
  globalThis.IntersectionObserver = class {
    root = null
    rootMargin = ''
    thresholds: ReadonlyArray<number> = []
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof IntersectionObserver
}

// -----------------------------------------------------------------------------
// react-shiki (syntax highlighter) cannot run in the headless jsdom CI sandbox
// — it needs WASM/network to load TextMate grammars & themes and hangs on a
// placeholder ("Code · tsc") instead of rendering the code. Unit tests only
// care about OUR rendering (the CodeCard wrapper, copy button, fences), not
// shiki's tokens, so mock it to emit the code text synchronously.
// -----------------------------------------------------------------------------
vi.mock('react-shiki', () => ({
  default: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('code', { className: 'block whitespace-pre' }, children),
}))
