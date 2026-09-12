'use client'

import { useStore } from '@nanostores/react'
import { type FC } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { $approvalModes, setApprovalMode, type ApprovalMode } from '@/store/approval-mode'
import { $activeGatewayProfile } from '@/store/profile'

function useActiveProfileKey(): string {
  return useStore($activeGatewayProfile) ?? 'default'
}
import { cn } from '@/lib/utils'

interface ApprovalModeMenuProps {
  className?: string
}

/** Approval mode selector for the shell. */
export const ApprovalModeMenu: FC<ApprovalModeMenuProps> = ({ className }) => {
  const profileKey = useActiveProfileKey()
  const modes = useStore($approvalModes)
  const current = modes[profileKey] ?? 'manual'

  const labels: Record<ApprovalMode, string> = {
    manual: 'Manual',
    smart: 'Smart',
    off: 'Auto',
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('gap-1.5 text-xs', className)}>
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          {labels[current]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['manual', 'smart', 'off'] as ApprovalMode[]).map(mode => (
          <DropdownMenuItem
            key={mode}
            onClick={() => setApprovalMode(profileKey, mode)}
            className={cn(mode === current && 'bg-accent')}
          >
            {labels[mode]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
