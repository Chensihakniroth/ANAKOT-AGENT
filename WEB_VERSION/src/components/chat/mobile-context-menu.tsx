import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ActionItem {
  label: string
  icon?: string
  onSelect: () => void
}

interface MobileContextMenuProps {
  /** Actions to show in the menu. */
  actions: ActionItem[]
  children: ReactNode
}

/**
 * Wraps children with a long-press → context menu on mobile. On desktop
 * this renders children unchanged.
 *
 * Long-press threshold: 500ms. A small haptic-via-visual indicator fires
 * on press-hold.
 */
export function MobileContextMenu({ actions, children }: MobileContextMenuProps) {
  const isMobile = useIsMobile()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)
  const itemRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  if (!isMobile) return <>{children}</>

  const close = useCallback(() => {
    setOpen(false)
    longPressedRef.current = false
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    longPressedRef.current = false
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      // Position the menu above the touch point, clamped to viewport
      const rect = itemRef.current?.getBoundingClientRect()
      const y = rect ? rect.top - 8 : e.clientY - 80
      const x = e.clientX
      setPosition({ x, y })
      setOpen(true)
    }, 500)
  }, [])

  const handlePointerMove = useCallback(() => {
    if (timerRef.current && !longPressedRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Close on scroll / route change
  useEffect(() => {
    if (!open) return
    const handler = () => close()
    window.addEventListener('scroll', handler, { once: true })
    return () => window.removeEventListener('scroll', handler)
  }, [open, close])

  // Close on tap outside
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest('[data-mobile-context-menu]')) {
        close()
      }
    }
    // Delay so the tap that triggered the menu doesn't close it immediately
    const id = setTimeout(() => document.addEventListener('pointerdown', handler), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', handler)
    }
  }, [open, close])

  return (
    <div
      ref={itemRef}
      className={cn(open && 'select-none')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {children}

      {/* Context menu popover */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} />

          {/* Menu */}
          <div
            data-mobile-context-menu
            className="fixed z-50 min-w-[140px] rounded-lg bg-(--dt-secondary) p-1 shadow-xl"
            style={{
              left: Math.min(position.x, window.innerWidth - 160),
              top: Math.max(12, Math.min(position.y - 8, window.innerHeight - actions.length * 44 - 16))
            }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-(--dt-secondary-foreground) active:bg-(--dt-accent)"
                onClick={() => {
                  action.onSelect()
                  close()
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
