'use client'

import { useStore } from '@nanostores/react'
import { type FC, type ReactNode } from 'react'

import { $hudVisible, $hudMode } from '@/store/hud'
import { cn } from '@/lib/utils'

interface HudShellProps {
  children: ReactNode
  className?: string
}

/** HUD container — positions the heads-up display overlay. */
export const HudShell: FC<HudShellProps> = ({ children, className }) => {
  const visible = useStore($hudVisible)
  const mode = useStore($hudMode)

  if (!visible || !mode) return null

  return (
    <div
      className={cn(
        'fixed left-1/2 top-3 z-40 -translate-x-1/2',
        'rounded-xl border border-[var(--stroke-nous)] bg-[var(--ui-chat-bubble-background)] shadow-lg',
        '[-webkit-app-region:no-drag]',
        className,
      )}
      data-hud-mode={mode}
    >
      {children}
    </div>
  )
}
