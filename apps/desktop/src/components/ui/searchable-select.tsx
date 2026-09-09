import { useState } from 'react'

import { cn } from '@/lib/utils'

import { Codicon } from './codicon'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/**
 * Scores a candidate option against a search string for ranking.
 *
 * - 2 = match on the last path segment (after the final `/`), boosting
 *   hierarchical options like `America/New_York` when searching `york`.
 * - 1 = substring match anywhere.
 * - 0 = no match.
 */
export function rankSearchOption(option: string, search: string): number {
  const needle = search.toLowerCase().trim()
  const haystack = option.toLowerCase()
  if (!needle) return 1

  if (haystack.includes(needle)) {
    const lastSegment = haystack.slice(haystack.lastIndexOf('/') + 1)
    if (lastSegment.includes(needle)) return 2
    return 1
  }

  return 0
}

export interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  emptyMessage?: string
  /** When set, a "clear" item appears atop the list that calls onChange('') */
  clearLabel?: string
  className?: string
}

/**
 * A searchable select (combobox) built on cmdk + Popover.
 *
 * Renders a trigger button that opens a popover with a search input and a
 * scrollable list of options. Filtering is client-side using `rankSearchOption`
 * with segment-aware scoring.
 *
 * Intended for settings panels that need a searchable picker (timezones,
 * endpoint selection, etc.) without adding a new dependency.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search…',
  emptyMessage = 'No results found.',
  clearLabel,
  className
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedLabel = value || placeholder

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'desktop-input-chrome flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[2.5px] border px-2.5 py-1.5 text-xs leading-4 text-foreground outline-none placeholder:text-muted-foreground',
            !value && 'text-muted-foreground',
            className
          )}
          role="combobox"
          type="button"
        >
          <span className="truncate">{selectedLabel}</span>
          <Codicon
            className="size-4 shrink-0 opacity-60"
            name="chevron-down"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command filter={(value, search) => rankSearchOption(value, search)}>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem
                  onSelect={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  <Codicon className="mr-2 size-4 opacity-0" name="check" />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map(option => (
                <CommandItem
                  key={option}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <Codicon
                    className={cn('mr-2 size-4', option === value ? 'opacity-100' : 'opacity-0')}
                    name="check"
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}