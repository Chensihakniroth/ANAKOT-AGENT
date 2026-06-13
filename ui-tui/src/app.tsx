import { useStore } from '@nanostores/react'

import { GatewayProvider } from './app/gatewayContext.js'
import { $uiState } from './app/uiStore.js'
import { useMainApp } from './app/useMainApp.js'
import { AppLayout } from './components/appLayout.js'
import { JARVISGoodbye } from './components/jarvisGoodbye.js'
import type { GatewayClient } from './gatewayClient.js'

export function App({ gw }: { gw: GatewayClient }) {
  const { appActions, appComposer, appProgress, appStatus, appTranscript, gateway } = useMainApp(gw)
  const { mouseTracking, shuttingDown, theme, usage } = useStore($uiState)

  if (shuttingDown) {
    return (
      <GatewayProvider value={gateway}>
        <JARVISGoodbye
          stats={{
            messages: appTranscript.historyItems.filter(m => m.role === 'user').length,
            toolsUsed: 0,
            contextUsed: usage?.context_used ?? 0,
            contextMax: usage?.context_max ?? 0,
            sessionDuration: '',
            cost: 0,
          }}
          reason="SIGINT"
          t={theme}
        />
      </GatewayProvider>
    )
  }

  return (
    <GatewayProvider value={gateway}>
      <AppLayout
        actions={appActions}
        composer={appComposer}
        mouseTracking={mouseTracking}
        progress={appProgress}
        status={appStatus}
        transcript={appTranscript}
      />
    </GatewayProvider>
  )
}
