'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { parseTranscriptDirectives } from '@/lib/transcript-directives'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface DirectiveActionsProps {
  text: string
  onAction?: (type: string, args: string) => void
  className?: string
}

/** Rich directive action buttons parsed from transcript content. */
export const DirectiveActions: FC<DirectiveActionsProps> = ({ text, onAction, className }) => {
  const { t } = useI18n()
  const directives = parseTranscriptDirectives(text)

  if (directives.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {directives.map(d => (
        <button
          key={d.raw}
          onClick={() => onAction?.(d.type, d.args)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
            'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors',
          )}
        >
          <span className="font-mono">[{d.type}]</span>
          {d.args && <span className="text-muted-foreground">{d.args}</span>}
        </button>
      ))}
    </div>
  )
}
