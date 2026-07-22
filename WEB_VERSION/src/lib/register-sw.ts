/**
 * Register the PWA service worker. Only runs in production (the Vite dev
 * server hot-reloads don't play well with SW caching), and only if the
 * browser supports it.
 *
 * Call this once from the app entry point after the initial render.
 */
export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[pwa] SW registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('[pwa] SW registration failed:', err)
        })
    })
  }
}
