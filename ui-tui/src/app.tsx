import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { GatewayProvider } from './app/gatewayContext.js'
import { $uiState } from './app/uiStore.js'
import { useMainApp } from './app/useMainApp.js'
import { AppLayout } from './components/appLayout.js'
import { JARVISGoodbye } from './components/jarvisGoodbye.js'
import type { GatewayClient } from './gatewayClient.js'

export function App({ gw }: { gw: GatewayClient }) {
  const { appActions, appComposer, appProgress, appStatus, appTranscript, gateway } = useMainApp(gw)
  const ui = useStore($uiState)

  // Keep a ref to the latest transcript data for shutdown capture
  const snapshotRef = useRef({ messages: 0, tools: 0, ctxUsed: 0, ctxMax: 0, cost: 0 })
  
  // Update the snapshot whenever transcript changes (but not during shutdown)
  useEffect(() => {
    if (!ui.shuttingDown) {
      const history = appTranscript.historyItems
      snapshotRef.current = {
        messages: history.length,
        tools: history.filter(m => m.role === 'tool').length,
        ctxUsed: ui.usage?.context_used ?? 0,
        ctxMax: ui.usage?.context_max ?? 0,
        cost: (ui.usage as any)?.cost ?? 0,
      }
    }
  }, [appTranscript.historyItems, ui.usage, ui.shuttingDown])

  if (ui.shuttingDown) {
    const data = snapshotRef.current

    return (
      <GatewayProvider value={gateway}>
        <JARVISGoodbye
          messages={data.messages}
          toolsUsed={data.tools}
          contextUsed={data.ctxUsed}
          contextMax={data.ctxMax}
          duration="—"
          cost={data.cost}
          reason="SIGINT"
          t={ui.theme}
        />
      </GatewayProvider>
    )
  }

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
