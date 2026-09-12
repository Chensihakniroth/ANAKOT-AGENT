'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { Button } from '@/components/ui/button'
import { $introSplashSeen, markIntroSplashSeen } from '@/store/intro-splash'
import { cn } from '@/lib/utils'

interface IntroSplashProps {
  className?: string
}

/** First-run intro splash screen. */
export const IntroSplash: FC<IntroSplashProps> = ({ className }) => {
  const seen = useStore($introSplashSeen)

  if (seen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md',
        'animate-in fade-in duration-500',
        className,
      )}
    >
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">
          Welcome to Anakot
        </h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          Your AI agent, your way. Let's get you set up.
        </p>
        <Button onClick={markIntroSplashSeen} size="lg">
          Get Started
        </Button>
      </div>
    </div>
  )
}
