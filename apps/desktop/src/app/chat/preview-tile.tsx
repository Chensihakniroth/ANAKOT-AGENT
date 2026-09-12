'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface PreviewTileProps {
  type: 'image' | 'file' | 'link' | 'code'
  src?: string
  title?: string
  description?: string
  onClick?: () => void
  className?: string
}

/** Inline preview tile component for chat flow. */
export const PreviewTile: FC<PreviewTileProps> = ({ type, src, title, description, onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-left',
        'hover:bg-muted/40 transition-colors w-full max-w-sm',
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
        {type === 'image' && '🖼️'}
        {type === 'file' && '📄'}
        {type === 'link' && '🔗'}
        {type === 'code' && '💻'}
      </div>
      <div className="min-w-0 flex-1">
        {title && <p className="truncate text-sm font-medium">{title}</p>}
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
    </button>
  )
}
