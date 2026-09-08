import { useCallback, useMemo, useRef, useState } from 'react'

import { probeModel } from '@/anakot'
import type { ModelProbeResponse } from '@/anakot'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { AlertTriangle, Brain, Loader2, Play, Wrench, XIcon, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import type { ModelOptionProvider } from '@/types/anakot'

interface ModelProbeScratchpadProps {
  model: string
  provider: ModelOptionProvider
  /** Fired when the user wants to commit to this (provider, model) after a
   *  successful probe. Mirrors the parent page's "Apply" — kept as a callback
   *  so the scratchpad doesn't have to know about the global main model. */
  onApply: (provider: ModelOptionProvider, model: string) => void | Promise<void>
}

const DEFAULT_PROMPT = 'In one sentence, what is 2+2?'
const MAX_PROMPT_CHARS = 1000

/** Build a list of human-readable "things you should know about this reply"
 *  warnings so the user never sees a silently empty / silently truncated /
 *  hallucinated tool-call / filtered response.  The scratchpad surfaces
 *  these next to the reply, not in a toast, so the context is preserved. */
function describeIssues(copy: ReturnType<typeof useI18n>['t']['freeModelSuite']['probe'], response: ModelProbeResponse): string[] {
  const issues: string[] = []
  const hasContent = response.content.trim().length > 0
  const hasReasoning = response.reasoning.trim().length > 0

  if (!hasContent && !hasReasoning) {
    if (response.tool_calls.length > 0) {
      const names = response.tool_calls.map(tc => tc.name || '(unnamed)').join(', ')
      issues.push(copy.issueNoAnswerTriedTool({ names }))
    } else if (response.finish_reason === 'content_filter') {
      issues.push(copy.issueFiltered)
    } else if (response.finish_reason === 'length') {
      issues.push(copy.issueTruncated)
    } else {
      issues.push(copy.issueEmpty)
    }
  } else if (!hasContent && hasReasoning) {
    // Reasoning model spent the whole budget thinking; visible answer is
    // missing. The reasoning block still gets rendered, but flag it.
    issues.push(copy.issueReasoningOnly)
  } else if (response.finish_reason === 'length') {
    issues.push(copy.issueReplyTruncated)
  } else if (response.finish_reason === 'content_filter') {
    issues.push(copy.issueReplyFiltered)
  }

  if (response.tool_calls.length > 0 && hasContent) {
    // Model emitted both a visible answer AND a tool call — odd, but real.
    // Surface so the user knows the tool call wasn't acted on.
    const names = response.tool_calls.map(tc => tc.name || '(unnamed)').join(', ')
    issues.push(copy.issueToolAlongsideText({ names }))
  }

  return issues
}

/** Inline scratchpad inside the Free Model Suite. Lets the user probe a free
 *  model with a single prompt before deciding to switch the main model to it.
 *  No state, no session — the backend `POST /api/v1/model/probe` runs a
 *  one-shot completion against the explicit (provider, model) pair. */
export function ModelProbeScratchpad({ model, provider, onApply }: ModelProbeScratchpadProps) {
  const { t } = useI18n()
  const copy = t.freeModelSuite.probe
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [busy, setBusy] = useState(false)
  const [response, setResponse] = useState<ModelProbeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  const issues = useMemo(
    () => (response ? describeIssues(copy, response) : []),
    [copy, response]
  )

  const reset = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  const run = useCallback(async () => {
    const trimmed = prompt.trim().slice(0, MAX_PROMPT_CHARS)

    if (!trimmed) {
      setError(copy.emptyPrompt)

      return
    }

    setBusy(true)
    setError(null)
    setResponse(null)

    try {
      const result = await probeModel({
        provider: provider.slug,
        model,
        prompt: trimmed,
        max_tokens: 1024,
        timeout_s: 30
      })

      setResponse(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      notifyError(err, copy.failed)
    } finally {
      setBusy(false)
    }
  }, [copy.emptyPrompt, copy.failed, model, prompt, provider.slug])

  const apply = useCallback(async () => {
    setApplying(true)

    try {
      await onApply(provider, model)
    } finally {
      setApplying(false)
    }
  }, [model, onApply, provider])

  if (!open) {
    return (
      <button
        className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => {
          setOpen(true)
          // Focus the textarea on next paint so the user can type straight away.
          requestAnimationFrame(() => promptRef.current?.focus())
        }}
        type="button"
      >
        <Zap className="size-3" />
        {copy.toggleOpen}
      </button>
    )
  }

  return (
    <div className="mt-1.5 grid gap-1.5 rounded-md border border-border/60 bg-background/60 p-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-(--ui-text-tertiary)">
          <Zap className="size-3" />
          {copy.title}
        </span>
        <button
          aria-label={copy.close}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setOpen(false)
            reset()
          }}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      </div>
      <textarea
        className="min-h-12 resize-y rounded-sm border border-border/60 bg-card/40 px-2 py-1 font-mono text-[0.7rem] leading-snug text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
        maxLength={MAX_PROMPT_CHARS}
        onChange={event => {
          setPrompt(event.target.value)

          if (error) {reset()}
        }}
        placeholder={copy.placeholder}
        ref={promptRef}
        rows={2}
        value={prompt}
      />
      <div className="flex items-center gap-1.5">
        <Button
          disabled={busy || !prompt.trim()}
          onClick={() => void run()}
          size="sm"
          variant="textStrong"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          {busy ? copy.running : copy.run}
        </Button>
        {response !== null && (
          <span className="text-[0.6rem] text-muted-foreground">{copy.reply(model)}</span>
        )}
      </div>
      {error && (
        <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1 text-[0.65rem] text-destructive">
          {error}
        </p>
      )}
      {response !== null && (
        <div className="grid gap-1.5">
          {issues.length > 0 && (
            <ul className="grid gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[0.65rem] text-amber-200">
              {issues.map((msg, idx) => (
                <li className="flex items-start gap-1.5" key={idx}>
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}
          {response.reasoning && (
            <details
              className={cn(
                'rounded-sm border border-border/40 bg-card/40',
                'text-[0.7rem] leading-snug text-(--ui-text-tertiary)'
              )}
            >
              <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 font-semibold">
                <Brain className="size-3" />
                {copy.reasoning}
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-t border-border/40 px-2 py-1.5 font-mono text-[0.65rem]">
                {response.reasoning}
              </pre>
            </details>
          )}
          {response.content && (
            <pre
              className={cn(
                'max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-sm border border-border/40 bg-card/40 px-2 py-1.5',
                'font-mono text-[0.7rem] leading-snug text-(--ui-text-primary)'
              )}
            >
              {response.content}
            </pre>
          )}
          {response.tool_calls.length > 0 && (
            <details
              className={cn(
                'rounded-sm border border-border/40 bg-card/40',
                'text-[0.7rem] leading-snug text-(--ui-text-tertiary)'
              )}
            >
              <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 font-semibold">
                <Wrench className="size-3" />
                {copy.toolCalls({ count: response.tool_calls.length })}
              </summary>
              <ul className="grid gap-1 border-t border-border/40 px-2 py-1.5">
                {response.tool_calls.map((tc, idx) => (
                  <li className="font-mono text-[0.65rem]" key={idx}>
                    <span className="font-semibold text-(--ui-text-primary)">
                      {tc.name || '(unnamed)'}
                    </span>
                    {tc.arguments && (
                      <pre className="mt-0.5 whitespace-pre-wrap break-words text-(--ui-text-tertiary)">
                        {tc.arguments}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <Button
              disabled={applying}
              onClick={() => void apply()}
              size="sm"
              variant="textStrong"
            >
              {applying ? <Loader2 className="size-3 animate-spin" /> : null}
              {applying ? copy.applying : copy.applyAfterProbe}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}