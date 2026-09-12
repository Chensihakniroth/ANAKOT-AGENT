'use client'

import { type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

interface MasterDetailProps {
  master: ReactNode
  detail: ReactNode
  /** Initial master width in px. Default 320. */
  initialMasterWidth?: number
  minMasterWidth?: number
  maxMasterWidth?: number
  className?: string
}

/** Split-pane master-detail layout with draggable resize handle. */
export function MasterDetail({
  master,
  detail,
  initialMasterWidth = 320,
  minMasterWidth = 200,
  maxMasterWidth = 600,
  className,
}: MasterDetailProps) {
  const [masterWidth, setMasterWidth] = useState(initialMasterWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handlePointerDown = (e: ReactPointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newWidth = e.clientX - rect.left
    setMasterWidth(Math.min(maxMasterWidth, Math.max(minMasterWidth, newWidth)))
  }

  const handlePointerUp = () => {
    dragging.current = false
  }

  return (
    <div ref={containerRef} className={cn('flex h-full', className)}>
      <div style={{ width: masterWidth }} className="shrink-0 overflow-hidden border-r border-border/30">
        {master}
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-1 shrink-0 cursor-ew-resize bg-transparent hover:bg-primary/20 transition-colors"
      />
      <div className="flex-1 overflow-hidden">
        {detail}
      </div>
    </div>
  )
}
