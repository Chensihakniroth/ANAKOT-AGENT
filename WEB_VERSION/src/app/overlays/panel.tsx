// ---------------------------------------------------------------------------
// Panel overlay wrapper — used by the Memory Graph (starmap) entry view.
// ---------------------------------------------------------------------------
import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { OverlayView } from './overlay-view'

interface PanelProps {
  children: ReactNode
  className?: string
  closeLabel?: string
  contentClassName?: string
  onClose: () => void
}

export function Panel({
  children,
  className,
  closeLabel = 'Close',
  contentClassName,
  onClose,
}: PanelProps) {
  return (
    <OverlayView
      closeLabel={closeLabel}
      contentClassName={cn(
        'flex h-full min-h-0 flex-col px-4 pb-4 pt-[calc(var(--titlebar-height)/2-0.4375rem)] sm:px-5',
        contentClassName,
      )}
      onClose={onClose}
      rootClassName={cn('flex h-full w-full flex-col', className)}
    >
      {children}
    </OverlayView>
  )
}

interface PanelHeaderProps {
  actions?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
}

export function PanelHeader({ actions, subtitle, title }: PanelHeaderProps) {
  return (
    <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="truncate text-xs text-muted-foreground/80">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden min-[47.5rem]:flex-row min-[47.5rem]:gap-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PanelDetail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}>
      <div className="space-y-4 pb-6 pl-1 pr-2">{children}</div>
    </div>
  )
}

interface PanelEmptyProps {
  action?: ReactNode
  description?: ReactNode
  icon?: string
  title?: ReactNode
}

export function PanelEmpty({
  action,
  description,
  icon = 'inbox',
  title,
}: PanelEmptyProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-(--ui-icon-background) text-xl text-(--ui-text-tertiary)">
        <span className={`codicon codicon-${icon}`} />
      </div>
      {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : null}
      {description ? <p className="max-w-[20rem] text-xs text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}
