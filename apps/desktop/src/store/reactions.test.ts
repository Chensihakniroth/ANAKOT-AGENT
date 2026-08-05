import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage } from '@/lib/chat-messages'
import { applyReaction, QUICK_REACTIONS, toggleMessageReaction } from './reactions'

const baseMessage: ChatMessage = {
  id: 'msg-1',
  role: 'user',
  parts: [{ type: 'text', text: 'hello' }],
  timestamp: 1,
  rowId: 42
}

const setMessagesCalls: ChatMessage[][] = []

vi.mock('@/store/session', () => ({
  $activeSessionId: { get: () => 'sess-1' },
  $messages: {
    get: () => [{ ...baseMessage, reactions: [] }]
  },
  setMessages: (fn: (messages: ChatMessage[]) => ChatMessage[]) => {
    setMessagesCalls.push(fn([{ ...baseMessage, reactions: [] }]))
  }
}))

const mockGatewayRequest = vi.fn()

vi.mock('@/store/gateway', () => ({
  activeGateway: vi.fn(() => ({ request: mockGatewayRequest }))
}))

vi.mock('@/store/notifications', () => ({
  notifyError: vi.fn()
}))

import { notifyError } from '@/store/notifications'
import { setMessages } from '@/store/session'

describe('applyReaction (pure)', () => {
  it('adds a reaction when the author has none', () => {
    const out = applyReaction([], '❤️', 'user')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ emoji: '❤️', author: 'user' })
    expect(typeof out[0].at).toBe('number')
  })

  it('retracts the same emoji (tapback toggle)', () => {
    const one = applyReaction([], '❤️', 'user')
    const out = applyReaction(one, '❤️', 'user')
    expect(out).toHaveLength(0)
  })

  it('replaces a different emoji from the same author', () => {
    const one = applyReaction([], '❤️', 'user')
    const out = applyReaction(one, '👍', 'user')
    expect(out).toHaveLength(1)
    expect(out[0].emoji).toBe('👍')
  })

  it('keeps other authors untouched', () => {
    const one = applyReaction([], '❤️', 'user')
    const out = applyReaction(one, '😂', 'agent')
    expect(out).toHaveLength(2)
    expect(out.map(r => r.author)).toEqual(['user', 'agent'])
  })

  it('clears the author on null emoji', () => {
    const one = applyReaction([], '❤️', 'user')
    const out = applyReaction(one, null, 'user')
    expect(out).toHaveLength(0)
  })
})

describe('toggleMessageReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMessagesCalls.length = 0
  })

  it('paints optimistically then commits the server list', async () => {
    mockGatewayRequest.mockResolvedValue({
      row_id: 42,
      reactions: [{ emoji: '❤️', author: 'user', at: 1 }]
    })

    await toggleMessageReaction(baseMessage, '❤️')

    // optimistic paint first
    expect(setMessagesCalls).toHaveLength(2)
    const [optimistic] = setMessagesCalls
    expect(optimistic[0].reactions).toHaveLength(1)

    expect(mockGatewayRequest).toHaveBeenCalledWith(
      'message.react',
      expect.objectContaining({ session_id: 'sess-1', row_id: 42, emoji: '❤️' })
    )
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('falls back to newest_role when the message has no rowId', async () => {
    mockGatewayRequest.mockResolvedValue({ row_id: 7, reactions: [] })

    await toggleMessageReaction({ ...baseMessage, rowId: undefined }, '👍')

    expect(mockGatewayRequest).toHaveBeenCalledWith(
      'message.react',
      expect.objectContaining({ newest_role: 'user' })
    )
    expect(mockGatewayRequest.mock.calls[0][1]).not.toHaveProperty('row_id')
  })

  it('rolls back and notifies on failure', async () => {
    mockGatewayRequest.mockRejectedValue(new Error('boom'))

    await toggleMessageReaction(baseMessage, '❤️')

    expect(setMessagesCalls).toHaveLength(2)
    const [optimistic, rollback] = setMessagesCalls
    expect(optimistic[0].reactions).toHaveLength(1)
    expect(rollback[0].reactions).toHaveLength(0)
    expect(notifyError).toHaveBeenCalled()
  })
})

describe('QUICK_REACTIONS', () => {
  it('ships the six classic tapbacks', () => {
    expect(QUICK_REACTIONS).toEqual(['❤️', '👍', '👎', '😂', '‼️', '❓'])
  })
})
