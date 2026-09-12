'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import { $activeSessionId } from '@/store/session'
import { cn } from '@/lib/utils'

interface ProfileTagProps {
  profileName: string
  className?: string
}

/** Visual profile indicator on messages. */
export const ProfileTag: FC<ProfileTagProps> = ({ profileName, className }) => {
  const activeId = useStore($activeSessionId)

  if (!profileName) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        'bg-primary/10 text-primary',
        className,
      )}
    >
      {profileName}
    </span>
  )
}
