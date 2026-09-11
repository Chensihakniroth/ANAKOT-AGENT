import { Box, Text } from '@anakot/ink'
import { useStore } from '@nanostores/react'
import { memo, useEffect, useState } from 'react'

import { useGateway } from '../app/gatewayContext.js'
import { $uiState } from '../app/uiStore.js'
import type { SessionActiveItem, SessionActiveListResponse } from '../gatewayTypes.js'
import { asRpcResult } from '../lib/rpc.js'
import { SIDEBAR_WIDTH } from '../lib/sidebar.js'
import type { Theme } from '../theme.js'

const STATUS_GLYPH: Record<string, string> = {
  idle: '✓',
  starting: '…',
  waiting: '?',
  working: '▶'
}

const shortModel = (model = '') => model.replace(/^.*\//, '') || 'model?'

// opencode keeps a always-pinnable live-session rail on the right edge of the
// transcript. Wide terminals show it by default; `<leader> b` (meta+b) forces
// it on/off. Clicking a row switches to that live session without closing the
// current one; the bottom row opens a fresh session.
export const SessionSidebar = memo(function SessionSidebar({
  onNew,
  onSelect,
  t
}: {
  onNew: () => void
  onSelect: (id: string) => void
  t: Theme
}) {
  const { gw } = useGateway()
  const ui = useStore($uiState)
  const [sessions, setSessions] = useState<SessionActiveItem[]>([])
  const [hoverId, setHoverId] = useState('')

  useEffect(() => {
    let stopped = false

    const refresh = () => {
      gw.request<SessionActiveListResponse>('session.active_list', { current_session_id: ui.sid })
        .then(raw => {
          const result = asRpcResult<SessionActiveListResponse>(raw)

          if (!stopped && result?.sessions) {
            setSessions(result.sessions)
          }
        })
        .catch(() => {})
    }

    refresh()
    const timer = setInterval(refresh, 2000)

    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [gw, ui.sid])

  const currentModel = ui.info?.model ? shortModel(ui.info.model) : ''

  return (
    <Box
      backgroundColor={t.color.bgPanel}
      borderBottom={false}
      borderColor={t.color.border}
      borderLeft
      borderRight={false}
      borderStyle="round"
      borderTop={false}
      flexDirection="column"
      flexShrink={0}
      width={SIDEBAR_WIDTH}
    >
      <Box justifyContent="space-between" paddingTop={1} paddingX={1}>
        <Text bold color={t.color.sessionLabel} wrap="truncate-end">
          {currentModel || 'Sessions'}
        </Text>

        <Text color={t.color.muted}>{sessions.length}</Text>
      </Box>

      <Text color={t.color.textDim} paddingBottom={1} paddingX={1}>
        active
      </Text>

      {sessions.length === 0 && (
        <Text color={t.color.muted} paddingX={1} paddingY={1}>
          no live sessions
        </Text>
      )}

      {sessions.map(s => {
        const status = s.status ?? 'idle'
        const current = s.current || s.id === ui.sid
        const title = s.title || s.preview || '(untitled)'

        return (
          <Box
            backgroundColor={current || hoverId === s.id ? t.color.bgElement : undefined}
            flexDirection="row"
            key={s.id}
            onClick={() => onSelect(s.id)}
            onMouseEnter={() => setHoverId(s.id)}
            onMouseLeave={() => setHoverId('')}
            paddingX={1}
            width="100%"
          >
            <Text color={status === 'working' ? t.color.ok : status === 'waiting' ? t.color.label : t.color.muted}>
              {STATUS_GLYPH[status] ?? '·'}
            </Text>

            <Text color={t.color.textMuted} flexShrink={0} width={12}>
              {shortModel(s.model)}
            </Text>

            <Text bold={current} color={current ? t.color.sessionLabel : t.color.text} flexGrow={1} flexShrink={1} minWidth={0} wrap="truncate-end">
              {title}
            </Text>
          </Box>
        )
      })}

      <Box flexGrow={1} />

      <Box
        backgroundColor={hoverId === '__new' ? t.color.bgElement : undefined}
        onClick={onNew}
        onMouseEnter={() => setHoverId('__new')}
        onMouseLeave={() => setHoverId('')}
        paddingBottom={1}
        paddingTop={1}
        paddingX={1}
      >
        <Text color={t.color.accent}>
          <Text color={t.color.sessionLabel}>+ </Text>
          new session
        </Text>
      </Box>
    </Box>
  )
})