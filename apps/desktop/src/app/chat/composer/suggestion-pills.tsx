'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { $composerSuggestions } from '@/store/composer-suggestions'

interface SuggestionPillsProps {
  onSelect?: (prompt: string) => void
  className?: string
}

/** Inline suggestion pills that appear below the composer. */
export const SuggestionPills: FC<SuggestionPillsProps> = ({ onSelect, className }) => {
  const { t } = useI18n()
  const suggestions = useStore($composerSuggestions)

  if (suggestions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5 px-1', className)}>
      {suggestions.slice(0, 4).map(s => (
        <button
          key={s.id}
          onClick={() => onSelect?.(s.prompt)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs',
            'bg-primary/10 text-primary hover:bg-primary/20 transition-colors',
          )}
        >
          {s.icon && <span className="text-[10px]">{s.icon}</span>}
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  )
}
