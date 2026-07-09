/**
 * Installs the web-compatible `window.anakotDesktop` shim.
 *
 * This runs before any React component mounts. The shim replaces Electron IPC
 * calls with fetch()-to-backend or no-ops, so the desktop UI code works
 * unmodified in a browser context.
 *
 * In production, the Python backend injects `window.__ANAKOT_SESSION_TOKEN__`
 * into index.html at serve time. In dev mode, the Vite `anakotDevToken()`
 * plugin scrapes the token from the running backend.
 */

import * as WebAnakotDesktop from './web-anakot-desktop'

export function installWebAnakotDesktop(): void {
  if (window.anakotDesktop) {
    // Already installed (e.g. HMR re-run)
    return
  }

  // Cast to match the interface declared in global.d.ts.
  // The shim provides all required methods; optional Electron-native features
  // (terminal, LSP, petOverlay, updates, uninstall, etc.) are stubs.
  window.anakotDesktop = WebAnakotDesktop as unknown as Window['anakotDesktop']

  // Request notification permission so `notify()` works.
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {
      /* user declined — fine */
    })
  }
}
