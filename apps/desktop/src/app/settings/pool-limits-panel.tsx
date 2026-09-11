import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { ListRow } from '@/app/settings/primitives'
import { $poolLimits, $poolLimitsLoading, loadPoolLimits, savePoolLimits, type PoolLimits } from '@/store/pool-limits'

// Convert ms to minutes for display
function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000)
}

// Convert minutes to ms for storage
function minutesToMs(minutes: number): number {
  return Math.max(60, minutes) * 60_000
}

/**
 * Settings → Advanced: warm-bot-backends count + backend idle timeout.
 * Device-local (not profile-scoped): the pool is sized once per machine and
 * changes apply live — main evicts/reaps to converge without a restart.
 */
export function PoolLimitsPanel() {
  const limits = useStore($poolLimits)
  const loading = useStore($poolLimitsLoading)
  const [maxDraft, setMaxDraft] = useState('')
  const [idleDraft, setIdleDraft] = useState('')

  useEffect(() => {
    void loadPoolLimits()
  }, [])

  useEffect(() => {
    if (limits) {
      setMaxDraft(String(limits.maxBackends))
      setIdleDraft(String(msToMinutes(limits.idleMs)))
    }
  }, [limits])

  const commitMax = () => {
    const parsed = Number(maxDraft)
    if (!Number.isFinite(parsed) || parsed === limits?.maxBackends) {
      setMaxDraft(String(limits?.maxBackends ?? 3))
      return
    }
    void savePoolLimits({ maxBackends: parsed })
  }

  const commitIdle = () => {
    const parsed = Number(idleDraft)
    const parsedMs = minutesToMs(parsed)
    if (!Number.isFinite(parsed) || parsedMs === limits?.idleMs) {
      setIdleDraft(String(msToMinutes(limits?.idleMs ?? 600_000)))
      return
    }
    void savePoolLimits({ idleMs: parsedMs })
  }

  if (loading && !limits) {
    return null
  }

  return (
    <>
      <ListRow
        action={
          <div className="flex items-center gap-2">
            <Input
              aria-label="Warm bot backends"
              className="w-20"
              inputMode="numeric"
              min={1}
              max={64}
              onBlur={commitMax}
              onChange={(event) => setMaxDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
              type="number"
              value={maxDraft}
            />
          </div>
        }
        description="How many bot backends stay running for instant switching. Higher = faster switches, more memory (~60MB per backend). Applies immediately."
        title="Warm Bot Backends"
      />
      <ListRow
        action={
          <div className="flex items-center gap-2">
            <Input
              aria-label="Backend idle timeout in minutes"
              className="w-20"
              inputMode="numeric"
              min={1}
              max={10080}
              onBlur={commitIdle}
              onChange={(event) => setIdleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
              type="number"
              value={idleDraft}
            />
            <span className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
              min
            </span>
          </div>
        }
        description="How long an unused bot backend stays warm before it is shut down. Raise this so bots you revisit every few minutes never pay a cold start."
        title="Backend Idle Timeout"
      />
    </>
  )
}
