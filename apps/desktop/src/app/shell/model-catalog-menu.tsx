'use client'

import { useStore } from '@nanostores/react'
import { type FC, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { $visibleModels } from '@/store/model-visibility'

interface ModelCatalogMenuProps {
  className?: string
}

/** Full model catalog browser in the sidebar. */
export const ModelCatalogMenu: FC<ModelCatalogMenuProps> = ({ className }) => {
  const visibleModels = useStore($visibleModels)
  const [search, setSearch] = useState('')

  const modelKeys = visibleModels ? Array.from(visibleModels) : []
  const filteredKeys = search.trim()
    ? modelKeys.filter(k => k.toLowerCase().includes(search.toLowerCase()))
    : modelKeys

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)}>
      <Input
        type="search"
        placeholder="Search models..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {filteredKeys.length > 0 ? (
          filteredKeys.map(key => (
            <label
              key={key}
              className="ml-4 flex items-center gap-2 rounded px-2 py-0.5 text-xs hover:bg-muted/30 cursor-pointer"
            >
              <input
                type="checkbox"
                defaultChecked
                className="h-3 w-3"
                onChange={() => {
                  // Toggle visibility
                }}
              />
              <span className="truncate">{key}</span>
            </label>
          ))
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">No models found</p>
        )}
      </div>
    </div>
  )
}
