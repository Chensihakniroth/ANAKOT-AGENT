'use client'

import { type FC, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface GlassProps {
  children: ReactNode
  className?: string
}

/** Glass-morphic overlay primitive — blur + transparency. */
export const Glass: FC<GlassProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'backdrop-blur-xl bg-background/60 border border-white/10 rounded-xl shadow-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
