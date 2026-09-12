'use client'

import { type FC, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { OnboardingGlyph } from './glyph'

interface OnboardingStep {
  title: string
  description: string
}

interface OnboardingFlowProps {
  steps: OnboardingStep[]
  onComplete: () => void
  onSkip?: () => void
  className?: string
}

/** Multi-step onboarding flow overlay. */
export const OnboardingFlow: FC<OnboardingFlowProps> = ({ steps, onComplete, onSkip, className }) => {
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1
  const current = steps[step]

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className,
      )}
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border bg-card p-8 shadow-xl">
        <OnboardingGlyph step={step} className="mx-auto mb-6" />

        <h2 className="mb-2 text-center text-xl font-semibold">{current.title}</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">{current.description}</p>

        <div className="mb-4 flex justify-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn('h-1.5 w-6 rounded-full transition-colors', i === step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {onSkip && !isLast && (
            <Button variant="ghost" onClick={onSkip} className="flex-1">
              Skip
            </Button>
          )}
          <Button
            onClick={() => {
              if (isLast) onComplete()
              else setStep(s => s + 1)
            }}
            className="flex-1"
          >
            {isLast ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
