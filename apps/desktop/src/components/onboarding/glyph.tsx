'use client'

import { type FC } from 'react'

import { cn } from '@/lib/utils'

interface OnboardingGlyphProps {
  step: number
  className?: string
}

/** Animated glyph/icon for onboarding steps. */
export const OnboardingGlyph: FC<OnboardingGlyphProps> = ({ step, className }) => {
  return (
    <div
      className={cn(
        'flex h-20 w-20 items-center justify-center rounded-2xl',
        'bg-gradient-to-br from-primary/20 to-primary/5 text-3xl',
        className,
      )}
    >
      {step === 0 && '👋'}
      {step === 1 && '🔑'}
      {step === 2 && '🤖'}
      {step === 3 && '✨'}
      {step > 3 && '✅'}
    </div>
  )
}
