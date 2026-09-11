import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { getProfiles } from '@/anakot'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $profiles } from '@/store/profile'
import { $settingsScopeOverride, setSettingsScope } from '@/store/settings-scope'

function ScopeChip({
  active,
  label,
  onSelect
}: {
  active: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      className={cn(
        'rounded-full border px-3 py-1 text-[length:var(--conversation-caption-font-size)] transition',
        active
          ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) text-(--ui-text-primary)'
          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
      )}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  )
}

/**
 * Shared "Applies to" profile selector for config-backed settings pages.
 * Backed by `$settingsScopeOverride` so selection persists across pages.
 * Hidden with fewer than two profiles.
 */
export function SettingsProfileScope({ className }: { className?: string }) {
  const { t } = useI18n()
  const scope = t.settings.profileScope
  const override = useStore($settingsScopeOverride)
  const profiles = useStore($profiles)

  // Refresh lazily so a profile created elsewhere shows up
  useEffect(() => {
    void getProfiles()
      .then(({ profiles }) => $profiles.set(profiles))
      .catch(() => undefined)
  }, [])

  if (profiles.length < 2) {
    return null
  }

  const selected = override || null
  const defaultProfile = profiles.find(p => p.is_default)

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
        {scope?.appliesTo ?? 'Applies to'}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {/* "All profiles" / default option */}
        <ScopeChip
          active={!selected}
          label={scope?.allProfiles ?? 'All profiles'}
          onSelect={() => setSettingsScope(null)}
        />
        {/* Individual profile chips */}
        {profiles.map(profile => (
          <ScopeChip
            key={profile.name}
            active={selected === profile.name}
            label={profile.name}
            onSelect={() => setSettingsScope(profile.name)}
          />
        ))}
      </div>
      {selected && defaultProfile && selected !== defaultProfile.name && (
        <p className="text-[0.72rem] text-muted-foreground">
          {scope?.editingProfile?.replace('{name}', selected) ?? `Editing settings for "${selected}"`}
        </p>
      )}
    </div>
  )
}
