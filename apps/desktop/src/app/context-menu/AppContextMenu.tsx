import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { $contextMenu, closeContextMenu } from './store'

/**
 * App-level context menu component.
 * Renders a floating menu at the cursor position with the provided items.
 * Click outside or Escape to close.
 */
export function AppContextMenu() {
  const menu = useStore($contextMenu)

  useEffect(() => {
    if (!menu) return

    const handleClick = () => closeContextMenu()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }

    // Delay to avoid the same click that opened it closing it immediately
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menu])

  if (!menu) return null

  return (
    <div
      className="fixed z-[200]"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="min-w-40 overflow-hidden rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-1 shadow-lg">
        {menu.items?.map((item, i) => (
          <button
            key={i}
            className={
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.82rem] transition-colors ' +
              (item.danger
                ? 'text-destructive hover:bg-destructive/10 '
                : 'text-foreground hover:bg-(--chrome-action-hover) ') +
              (item.disabled ? 'cursor-not-allowed opacity-50 ' : 'cursor-pointer ')
            }
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onSelect()
                closeContextMenu()
              }
            }}
          >
            {item.icon && <span className="size-4 shrink-0">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span className="text-[0.7rem] text-muted-foreground">{item.shortcut}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
