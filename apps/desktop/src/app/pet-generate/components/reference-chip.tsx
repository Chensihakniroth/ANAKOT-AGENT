import { useState } from 'react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { X } from '@/lib/icons'

interface ReferenceChipProps {
  name: string
  onRemove: () => void
  src: string
}

// The reference photo as an attachment chip: filename + thumbnail that opens
// a lightbox, with a remove affordance.
export function ReferenceChip({ name, onRemove, src }: ReferenceChipProps) {
  const { t } = useI18n()
  const [viewing, setViewing] = useState(false)

  return (
    <div className="ml-auto flex h-6 items-center gap-2 self-start rounded-lg border border-border/60 bg-background/50 pl-1 pr-2">
      <button className="shrink-0" onClick={() => setViewing(true)} title={t.desktop.openImage} type="button">
        <img alt={name} className="size-4 rounded-md object-cover" src={src} />
      </button>

      <span className="max-w-40 truncate text-[0.64rem] font-medium text-foreground/50">{name || 'Reference'}</span>
      <button
        aria-label="Remove reference"
        className="text-(--ui-text-tertiary) transition not-hover:opacity-50"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>

      <Dialog onOpenChange={setViewing} open={viewing}>
        <DialogContent
          className="block w-auto max-h-[calc(100vh-12rem)] max-w-[calc(100vw-12rem)] overflow-visible border-0 bg-transparent p-0 shadow-none"
          showCloseButton={false}
        >
          <img
            alt={name}
            className="block max-h-[calc(100vh-12rem)] max-w-[calc(100vw-12rem)] cursor-zoom-out select-auto rounded-lg object-contain shadow-2xl"
            onClick={() => setViewing(false)}
            src={src}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
