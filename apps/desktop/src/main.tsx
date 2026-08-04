import './styles.css'
import './custom-styles.css'
// Must run before any Monaco editor mounts — bundles monaco-editor locally
// instead of fetching it from the jsdelivr CDN at runtime.
import './lib/monaco-setup'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import App from './app'
import { ErrorBoundary } from './components/error-boundary'
import { HapticsProvider } from './components/haptics-provider'
import { I18nProvider } from './i18n'
import { installClipboardShim } from './lib/clipboard'
import { queryClient } from './lib/query-client'
import { ThemeProvider } from './themes/context'
import { exposePluginSDK } from './app/plugins/registry'

installClipboardShim()
exposePluginSDK()

// Dev-only: install __PERF_DRIVE__ + __PERF_PROBE__ on window so the
// scripts/ harnesses can drive a synthetic stream + record render cost.

if (new URLSearchParams(window.location.search).get('win') === 'overlay') {
  import('./app/pet-overlay/overlay-root').then(({ mountPetOverlay }) => mountPetOverlay())
} else {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary label="root">
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <HapticsProvider>
              <HashRouter>
                <App />
              </HashRouter>
            </HapticsProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
