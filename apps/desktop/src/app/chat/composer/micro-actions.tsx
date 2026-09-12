'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { $composerActionsBySession } from '@/store/composer-actions'

interface ComposerMicroActionsProps {
  sessionId: string
  className?: string
}

/** Floating pill strip at the top of the composer's overlay lane. */
export const ComposerMicroActions: FC<ComposerMicroActionsProps> = ({ sessionId, className }) => {
  const { t } = useI18n()
  const actionsBySession = useStore($composerActionsBySession)
  const actions = actionsBySession[sessionId] ?? []

  if (actions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5 px-1 py-0.5', className)}>
      {actions.map(action => (
        <button
          key={action.id}
          disabled={action.disabled}
          onClick={() => void action.run(sessionId)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs',
            'border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors',
            action.disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          {action.icon && <span className="text-[10px]">{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}
