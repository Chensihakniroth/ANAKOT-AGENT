'use client'

import { type FC, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

interface BrowserPopoutShellProps {
  url: string
  className?: string
}

/** Shell for a popped-out browser window. */
export const BrowserPopoutShell: FC<BrowserPopoutShellProps> = ({ url, className }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  return (
    <div className={cn('flex h-full w-full flex-col', className)}>
      <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-1.5">
        <span className="truncate text-xs text-muted-foreground">{url}</span>
      </div>
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Browser popout"
      />
    </div>
  )
}
