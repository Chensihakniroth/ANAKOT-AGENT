// Approval mode — tool call approval modes: manual, smart, off.
// Manual: always ask. Smart: auto-approve safe ops, ask for risky. Off: never ask.

import { atom } from 'nanostores'

export type ApprovalMode = 'manual' | 'smart' | 'off'

const APPROVAL_MODES: Set<ApprovalMode> = new Set(['manual', 'smart', 'off'])
const confirmedModes = new Map<string, ApprovalMode>()

export const $approvalModes = atom<Record<string, ApprovalMode>>({})

export function setApprovalMode(profile: string, mode: ApprovalMode): void {
  const key = profile.trim() || 'default'
  $approvalModes.set({ ...$approvalModes.get(), [key]: mode })
}

export function getApprovalMode(profile: string): ApprovalMode {
  const key = profile.trim() || 'default'
  return $approvalModes.get()[key] ?? 'manual'
}

export function confirmModeSwitch(profile: string, method: string): boolean {
  const mode = getApprovalMode(profile)
  if (mode === 'off') return false // never ask
  if (mode === 'smart') {
    // Auto-approve safe methods (read-only, non-destructive)
    const safePrefixes = ['get_', 'list_', 'read_', 'search_', 'describe_']
    return !safePrefixes.some(p => method.startsWith(p))
  }
  return true // manual: always confirm
}
