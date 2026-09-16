import { EventEmitter } from 'events'
import React from 'react'
import { describe, expect, it } from 'vitest'

import Text from './components/Text.js'
import Ink from './ink.js'
import { CURSOR_HOME, ERASE_SCREEN } from './termio/csi.js'

class FakeTty extends EventEmitter {
  chunks: string[] = []
  columns = 20
  rows = 5
  isTTY = true

  write(chunk: string | Uint8Array, cb?: (err?: Error | null) => void): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    cb?.()
    return true
  }
}

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve))

describe('Ink resize healing', () => {
  it('heals same-dimension alt-screen resize events with an erase before repaint', async () => {
    const stdout = new FakeTty()
    const stdin = new FakeTty()
    const stderr = new FakeTty()
    const ink = new Ink({
      exitOnCtrlC: false,
      patchConsole: false,
      stderr: stderr as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream
    })

    ink.setAltScreenActive(true)
    ink.render(React.createElement(Text, null, 'hello'))
    ink.onRender()
    stdout.chunks = []

    stdout.emit('resize')
    ink.onRender()
    await tick()

    expect(stdout.chunks.join('')).toContain(ERASE_SCREEN + CURSOR_HOME)

    ink.unmount()
  })

  it('rebuilds every frame buffer at the new fullscreen dimensions', async () => {
    const stdout = new FakeTty()
    const stdin = new FakeTty()
    const stderr = new FakeTty()
    const ink = new Ink({
      exitOnCtrlC: false,
      patchConsole: false,
      stderr: stderr as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream
    })

    ink.setAltScreenActive(true)
    ink.render(React.createElement(Text, null, 'hello'))
    ink.onRender()
    stdout.chunks = []

    stdout.columns = 80
    stdout.rows = 30
    stdout.emit('resize')
    await tick()

    const state = ink as unknown as {
      frontFrame: { screen: { height: number; width: number } }
      terminalColumns: number
      terminalRows: number
    }

    expect(state.terminalColumns).toBe(80)
    expect(state.terminalRows).toBe(30)
    expect(state.frontFrame.screen.width).toBe(80)
    expect(state.frontFrame.screen.height).toBe(30)
    expect(stdout.chunks.join('')).toContain(ERASE_SCREEN + CURSOR_HOME)

    ink.unmount()
  })

  it('recovers when the PTY reports zero dimensions during maximize', async () => {
    const stdout = new FakeTty()
    const stdin = new FakeTty()
    const stderr = new FakeTty()
    const ink = new Ink({
      exitOnCtrlC: false,
      patchConsole: false,
      stderr: stderr as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream
    })

    ink.setAltScreenActive(true)
    ink.render(React.createElement(Text, null, 'hello'))
    ink.onRender()

    stdout.columns = 0
    stdout.rows = 0
    stdout.emit('resize')
    stdout.columns = 120
    stdout.rows = 40
    await new Promise(resolve => setTimeout(resolve, 190))

    const state = ink as unknown as {
      frontFrame: { screen: { height: number; width: number } }
      terminalColumns: number
      terminalRows: number
    }

    expect(state.terminalColumns).toBe(120)
    expect(state.terminalRows).toBe(40)
    expect(state.frontFrame.screen.width).toBe(120)
    expect(state.frontFrame.screen.height).toBe(40)

    ink.unmount()
  })
})
