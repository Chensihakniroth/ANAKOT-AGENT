import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { setCurrentModel, setCurrentProvider } from '@/store/session'
import type { ModelOptionProvider } from '@/types/anakot'

// Radix UI components call scrollIntoView / hasPointerCapture on open; jsdom
// doesn't implement them. Stub like model-settings.test.tsx.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

const setGlobalModel = vi.fn()
const probeModelMock = vi.fn()
const requestModelOptions = vi.fn()
const onMainModelChanged = vi.fn()
const mockNotify = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/anakot', () => ({
  setGlobalModel: (provider: string, model: string) => setGlobalModel(provider, model),
  probeModel: (body: unknown) => probeModelMock(body)
}))

vi.mock('@/lib/model-options', () => ({
  requestModelOptions: (_opts: unknown) => requestModelOptions(_opts)
}))

vi.mock('@/store/notifications', () => ({
  notify: (input: unknown) => mockNotify(input),
  notifyError: (error: unknown, fallback: string) => mockNotifyError(error, fallback)
}))

const callmemo: ModelOptionProvider = {
  name: 'callmemo',
  slug: 'nous',
  models: ['anakot-4', 'anakot-4-mini'],
  authenticated: false,
  free_tier: true,
  pricing: {
    'anakot-4': { cache: null, free: true, input: '0', output: '0' },
    'anakot-4-mini': { cache: null, free: true, input: '0', output: '0' }
  }
}

const deepseek: ModelOptionProvider = {
  name: 'DeepSeek',
  slug: 'deepseek',
  models: ['deepseek-chat', 'deepseek-reasoner'],
  authenticated: true,
  pricing: {
    'deepseek-chat': { cache: null, free: true, input: '0', output: '0' },
    'deepseek-reasoner': { cache: null, free: true, input: '0', output: '0' }
  },
  context_windows: {
    'deepseek-chat': 128000,
    'deepseek-reasoner': 64000
  }
}

// A paid provider with no free models — must not appear in the suite.
const openrouter: ModelOptionProvider = {
  name: 'OpenRouter',
  slug: 'openrouter',
  models: ['anthropic/claude-opus-4.7'],
  authenticated: true,
  free_tier: false,
  pricing: {
    'anthropic/claude-opus-4.7': { cache: null, free: false, input: '5', output: '25' }
  }
}

beforeEach(() => {
  setGlobalModel.mockReset()
  probeModelMock.mockReset()
  requestModelOptions.mockReset()
  onMainModelChanged.mockReset()
  mockNotify.mockReset()
  mockNotifyError.mockReset()

  requestModelOptions.mockResolvedValue({ providers: [callmemo, deepseek, openrouter] })
  setCurrentProvider('deepseek')
  setCurrentModel('deepseek-chat')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderFreeModelSuite() {
  const { FreeModelSuiteSettings } = await import('./free-model-suite-settings')

  const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 60_000 } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider configClient={null}>
        <FreeModelSuiteSettings onMainModelChanged={onMainModelChanged} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('FreeModelSuiteSettings', () => {
  it('lists free models grouped by provider and excludes paid ones', async () => {
    await renderFreeModelSuite()

    await waitFor(() => expect(requestModelOptions).toHaveBeenCalled())

    expect(await screen.findByText('Free Model Suite')).toBeTruthy()
    // Callmemo is configured in the catalog but unavailable in this account.
    expect(screen.queryByText('callmemo')).toBeNull()
    expect(await screen.findByText('DeepSeek')).toBeTruthy()
    expect(await screen.findByText('Deepseek Chat')).toBeTruthy()
    // Paid provider must not appear in a free-only suite.
    expect(screen.queryByText('OpenRouter')).toBeNull()
    expect(screen.queryByText('anthropic/claude-opus-4.7')).toBeNull()
  }, 10_000)

  it('shows free models with a :free suffix from connected providers', async () => {
    requestModelOptions.mockResolvedValue({
      providers: [
        {
          ...openrouter,
          models: ['meta/llama-3:free'],
          authenticated: true,
          pricing: {}
        },
        deepseek
      ]
    })

    await renderFreeModelSuite()

    expect(await screen.findByText('OpenRouter')).toBeTruthy()
    expect((await screen.findAllByText('Llama 3:Free')).length).toBeGreaterThan(0)
  })

  it('includes authenticated OpenCode Zen free models with context size', async () => {
    requestModelOptions.mockResolvedValue({
      providers: [
        {
          name: 'OpenCode Zen',
          slug: 'opencode-zen',
          models: ['minimax-m2.5-free'],
          authenticated: true,
          context_windows: { 'minimax-m2.5-free': 32768 }
        }
      ]
    })

    await renderFreeModelSuite()

    expect(await screen.findByText('OpenCode Zen')).toBeTruthy()
    expect(await screen.findByText('Minimax M2.5 Free')).toBeTruthy()
    expect(await screen.findByText('33K context')).toBeTruthy()
  })

  it('marks the currently-selected free model as current and disables its button', async () => {
    await renderFreeModelSuite()

    const currentButtons = await screen.findAllByRole('button', { name: 'Current' })
    expect(currentButtons).toHaveLength(1)

    // The Apply button for the already-current model is gone (replaced by
    // "Current"); only the other free models still show "Apply".
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(1)
  })

  it('persists the switch to the backend and notifies the host so the chat stops falling back', async () => {
    await renderFreeModelSuite()

    const applyButtons = await screen.findAllByRole('button', { name: 'Apply' })
    // First Apply is the first listed free model of the first provider.
    fireEvent.click(applyButtons[0])

    await waitFor(() => expect(setGlobalModel).toHaveBeenCalled())
    expect(setGlobalModel).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner')
    expect(onMainModelChanged).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner')
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: expect.any(String) })
    )
  })

  it('filters free models by search term', async () => {
    await renderFreeModelSuite()

    const search = await screen.findByPlaceholderText(/Filter free models/i)
    fireEvent.change(search, { target: { value: 'deepseek' } })

    expect(await screen.findByText('Deepseek Chat')).toBeTruthy()
    expect(screen.queryByText('deepseek-chat')).toBeNull()
  })

  it('reports no results when the search matches nothing', async () => {
    await renderFreeModelSuite()

    const search = await screen.findByPlaceholderText(/Filter free models/i)
    fireEvent.change(search, { target: { value: 'zzz-not-a-model' } })

    expect(await screen.findByText('No results.')).toBeTruthy()
  })

  it('notifies on switch failure without throwing', async () => {
    setGlobalModel.mockRejectedValueOnce(new Error('provider down'))

    await renderFreeModelSuite()

    const applyButtons = await screen.findAllByRole('button', { name: 'Apply' })
    fireEvent.click(applyButtons[0])

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalled())
    expect(mockNotifyError).toHaveBeenCalledWith(expect.any(Error), 'Model switch failed')
    // Optimistic atom update still happened before the failure.
    expect(onMainModelChanged).not.toHaveBeenCalled()
  })

  it('probes a free model from the scratchpad and surfaces the reply', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      content: 'four',
      reasoning: '',
      finish_reason: 'stop',
      tool_calls: []
    })

    await renderFreeModelSuite()

    // Open the scratchpad on the first non-current free model.
    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])

    const textarea = await screen.findByPlaceholderText(/Prompt to test this model with/i)
    fireEvent.change(textarea, { target: { value: 'what is 2+2?' } })

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(probeModelMock).toHaveBeenCalled())
    expect(probeModelMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-reasoner', prompt: 'what is 2+2?' })
    )
    expect(await screen.findByText('four')).toBeTruthy()
  })

  it('shows the probe error inline and notifies on failure', async () => {
    probeModelMock.mockRejectedValueOnce(new Error('boom'))

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])

    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(await screen.findByText('boom')).toBeTruthy()
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith(expect.any(Error), 'Probe failed'))
  })

  it('commits to the model via the scratchpad Apply button', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      content: 'four',
      reasoning: '',
      finish_reason: 'stop',
      tool_calls: []
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await screen.findByText('four')

    fireEvent.click(screen.getByRole('button', { name: 'Apply this model' }))

    await waitFor(() => expect(setGlobalModel).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner'))
    expect(onMainModelChanged).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner')
  })

  it('surfaces reasoning content when a reasoning model returns it', async () => {
    // DeepSeek-R1-style: answer is in reasoning_content, content is empty.
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      content: '',
      reasoning: 'I need to add 2 and 2. The answer is 4.',
      finish_reason: 'stop',
      tool_calls: []
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(
      await screen.findByText(/Model spent its token budget on thinking/i)
    ).toBeTruthy()
    expect(screen.getByText('Reasoning')).toBeTruthy()
    // Reasoning is collapsed by default — the text sits inside <details>.
    expect(screen.getByText(/I need to add 2 and 2/)).toBeTruthy()
  })

  it('flags a finish_reason: length reply even when content is present', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'openrouter',
      model: 'some-truncating-model',
      content: 'A partial answer that was cut off mid-',
      reasoning: '',
      finish_reason: 'length',
      tool_calls: []
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(await screen.findByText(/Reply was truncated at the max_tokens budget/i)).toBeTruthy()
    expect(screen.getByText('A partial answer that was cut off mid-')).toBeTruthy()
  })

  it('flags a content_filter response and does not pretend it is empty', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      content: '',
      reasoning: '',
      finish_reason: 'content_filter',
      tool_calls: []
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(await screen.findByText(/Provider filtered the entire response/i)).toBeTruthy()
  })

  it('surfaces hallucinated tool_calls when the model tries to call a tool we did not provide', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'openrouter',
      model: 'tool-happy',
      content: '',
      reasoning: '',
      finish_reason: 'tool_calls',
      tool_calls: [
        { name: 'shell_exec', arguments: '{"command":"rm -rf /"}' }
      ]
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(await screen.findByText(/tried to call a tool we did not provide/)).toBeTruthy()
    expect(screen.getByText('shell_exec')).toBeTruthy()
  })

  it('flags a tool_call emitted alongside a visible answer', async () => {
    probeModelMock.mockResolvedValueOnce({
      ok: true,
      provider: 'openrouter',
      model: 'half-broken',
      content: 'Here is your answer.',
      reasoning: '',
      finish_reason: 'tool_calls',
      tool_calls: [
        { name: 'foo', arguments: '{}' }
      ]
    })

    await renderFreeModelSuite()

    const tryItButtons = await screen.findAllByRole('button', { name: 'Try it first' })
    fireEvent.click(tryItButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(await screen.findByText('Here is your answer.')).toBeTruthy()
    expect(await screen.findByText(/also emitted tool call/)).toBeTruthy()
  })
})