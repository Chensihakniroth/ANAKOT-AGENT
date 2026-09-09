import { useEffect, useRef } from 'react'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { useStore } from '@nanostores/react'
import { searchStore, setSearchQuery } from './search-store'

interface SettingsSearchBarProps {
  className?: string
  onSearchChange?: (query: string) => void
}

export function SettingsSearchBar({ className, onSearchChange }: SettingsSearchBarProps) {
  const { t } = useI18n()
  const store = useStore(searchStore)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl/Cmd+K shortcut for opening search
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key === 'k' || event.key === 'K'
      if (!isK) return
      const isEditable = event.target instanceof HTMLElement && (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable
      )
      // Don't steal focus from text inputs
      if (isEditable && document.activeElement === event.target) return

      const isCtrl = event.ctrlKey
      const isMeta = event.metaKey
      if (!isCtrl && !isMeta) return

      event.preventDefault()
      triggerHaptic('tap')
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    onSearchChange?.(e.target.value)
  }

  const handleInputClear = () => {
    setSearchQuery('')
    onSearchChange?.('')
    inputRef.current?.focus()
  }

  const handleFocus = () => {
    triggerHaptic('tap')
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={store.query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Search settings..."
          className="w-full px-3 py-2 pl-9 pr-8 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {store.query && (
          <button
            onClick={handleInputClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {store.query && (
        <div className="mt-2 text-xs text-muted-foreground">
          {store.matchedKeys.length > 0 ? (
            <>Found {store.matchedKeys.length} matching setting{store.matchedKeys.length !== 1 ? 's' : ''}</>
          ) : (
            <>No matching settings found</>
          )}
        </div>
      )}
    </div>
  )
}