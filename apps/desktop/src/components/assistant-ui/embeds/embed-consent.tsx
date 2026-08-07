'use client'

import { type CSSProperties, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Play } from '@/lib/icons'
import { allowProvider } from '@/store/embed-consent'

import type { EmbedDescriptor } from './providers/types'

// Privacy placeholder shown before an embed reaches out to a third party. Sized
// to the embed's footprint (no layout shift). The control mirrors the commit
// button: primary "Load" (this embed) plus "Always allow <service>" (persisted).
// Global off lives in Appearance settings.
export function EmbedFacade({ descriptor, onLoad }: { descriptor: EmbedDescriptor; onLoad: () => void }) {
  const style: CSSProperties = descriptor.aspectRatio
    ? { aspectRatio: descriptor.aspectRatio }
    : { height: descriptor.height ?? 320 }

  return (
    <span
      className="flex size-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary)/30"
      style={style}
    >
      <span className="flex items-center gap-1.5">
        <Button onClick={onLoad} size="sm" variant="secondary">
          <Play className="size-3 translate-x-px fill-current" />
          Load {descriptor.label}
        </Button>
        <Button onClick={() => allowProvider(descriptor.provider)} size="sm" variant="ghost">
          Always allow {descriptor.label}
        </Button>
      </span>
      <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{hostOf(descriptor)}</span>
    </span>
  )
}

function hostOf(descriptor: EmbedDescriptor): string {
  // x.com posts often arrive as twitter.com links — show the current brand.
  if (descriptor.provider === 'twitter') {
    return 'x.com'
  }

  try {
    return new URL(descriptor.sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return descriptor.label
  }
}
