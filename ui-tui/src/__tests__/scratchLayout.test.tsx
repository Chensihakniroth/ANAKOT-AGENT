import { renderSync } from '@anakot/ink'
import React from 'react'
import { PassThrough } from 'stream'
import { describe, expect, it } from 'vitest'

import type { AppLayoutProps } from '../app/interfaces.js'
import { GatewayProvider } from '../app/gatewayContext.js'
import { AppLayout } from '../components/appLayout.js'
import { introMsg } from '../domain/messages.js'
import { stripAnsi } from '../lib/text.js'

describe('scratch full AppLayout repro', () => {
  it('renders banner art and user message with sidebar visible at 154 cols', () => {
    const stdout = new PassThrough()
    const stdin = new PassThrough()
    const stderr = new PassThrough()
    let output = ''

    Object.assign(stdout, { columns: 154, isTTY: false, rows: 24 })
    Object.assign(stdin, { isTTY: false })
    Object.assign(stderr, { isTTY: false })
    stdout.on('data', chunk => {
      output += chunk.toString()
    })

    const noop = () => {}
    const intro = introMsg({ model: 'test-model', version: 'test', skills: {}, tools: {} } as never)
    const user = { role: 'user' as const, text: 'test' }
    const virtualRows = [
      { index: 0, key: 'intro:c120', msg: intro },
      { index: 1, key: 'test:c120', msg: user }
    ]

    const props = {
      actions: {
        answerApproval: noop,
        answerClarify: noop,
        answerSecret: noop,
        answerSudo: noop,
        clearSelection: noop,
        activateLiveSession: noop,
        closeLiveSession: async () => null,
        newLiveSession: noop,
        newPromptSession: noop,
        onModelSelect: noop,
        resumeById: noop,
        setStickyPrompt: noop
      },
      composer: {
        cols: 120,
        compIdx: 0,
        completions: [],
        empty: true,
        handleTextPaste: async () => null,
        input: '',
        inputBuf: [],
        pagerPageSize: 10,
        queueEditIdx: null,
        queuedDisplay: [],
        sidebarVisible: true,
        submit: noop,
        updateInput: noop,
        voiceRecordKey: null
      },
      mouseTracking: 'none',
      progress: { showProgressArea: false },
      status: {
        cwdLabel: '',
        goodVibesTick: 0,
        sessionStartedAt: null,
        showStickyPrompt: false,
        statusColor: '',
        stickyPrompt: '',
        turnStartedAt: null,
        voiceLabel: ''
      },
      transcript: {
        historyItems: [intro, user],
        scrollRef: { current: null },
        virtualHistory: {
          bottomSpacer: 0,
          end: 2,
          measureRef: () => () => {},
          offsets: [0, 10, 12],
          start: 0,
          topSpacer: 0
        },
        virtualRows
      }
    } as AppLayoutProps

    const instance = renderSync(
      React.createElement(
        GatewayProvider as never,
        { value: { gw: { request: async () => null } } },
        React.createElement(AppLayout, props)
      ),
      {
        patchConsole: false,
        stderr: stderr as NodeJS.WriteStream,
        stdin: stdin as NodeJS.ReadStream,
        stdout: stdout as NodeJS.WriteStream
      }
    )

    instance.unmount()
    instance.cleanup()

    const plain = stripAnsi(output)

    require('node:fs').writeFileSync('src/__tests__/scratchLayout.out.txt', plain, 'utf-8')

    expect(plain).toContain('new session')
    expect(plain).toContain('test')
    expect(plain).toContain('anakot')
  })
})