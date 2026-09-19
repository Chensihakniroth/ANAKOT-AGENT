import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { GatewayProvider } from './app/gatewayContext.js'
import { $uiState } from './app/uiStore.js'
import { useMainApp } from './app/useMainApp.js'
import { AppLayout } from './components/appLayout.js'
import type { GatewayClient } from './gatewayClient.js'

export function App({ gw }: { gw: GatewayClient }) {
  const { appActions, appComposer, appProgress, appStatus, appTranscript, gateway } = useMainApp(gw)
  const ui = useStore($uiState)

  // Clean exit: reset terminal and exit immediately on shutdown
  useEffect(() => {
    if (ui.shuttingDown) {
      process.stdout.write('\x1b[?25h')   // Show cursor
      process.stdout.write('\x1b[2J')     // Clear AlternateScreen
      process.stdout.write('\x1b[H')      // Cursor to top-left
      process.stdout.write('\x1b[?1049l')  // Exit AlternateScreen buffer
      process.stdout.write('\x1b[2J')     // Clear visible area
      process.stdout.write('\x1b[H')      // Cursor to top-left
      process.stdout.write('\x1b[3J')     // Clear scrollback buffer
      process.exit(0)
    }
  }, [ui.shuttingDown])

  return (
    <GatewayProvider value={gateway}>
      <AppLayout
        actions={appActions}
        composer={appComposer}
        mouseTracking={ui.mouseTracking}
        progress={appProgress}
        status={appStatus}
        transcript={appTranscript}
      />
    </GatewayProvider>
  )
}
