import { type ReactNode } from 'react'
import { OverlayView } from './overlay-view'

interface OverlayModalProps {
  children: ReactNode
  onClose: () => void
  title?: string
}

export function OverlayModal({ children, onClose, title }: OverlayModalProps) {
  return (
    <OverlayView onClose={onClose}>
      <div className="flex h-full flex-col">
        {/* Header */}
        {title && (
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-(--ui-stroke-secondary) px-4">
            <span className="text-sm font-medium">{title}</span>
          </div>
        )}
        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </OverlayView>
  )
}
