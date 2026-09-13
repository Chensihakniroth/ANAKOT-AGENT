
import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { $skills, installSkill, toggleSkill } from '@/store/agent-plugins'
import { notify } from '@/store/notifications'

export function SkillsView({ setStatusbarItemGroup }: { setStatusbarItemGroup?: unknown }) {
  const skills = useStore($skills)
  const [search, setSearch] = useState('')

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {filtered.map(skill => (
          <div
            key={skill.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <h3 className="font-medium">{skill.name}</h3>
              <p className="text-sm text-muted-foreground">{skill.description}</p>
            </div>
            <Button
              variant={skill.enabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSkill(skill.id)}
            >
              {skill.enabled ? 'Enabled' : 'Enable'}
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground">No skills found</p>
        )}
      </div>
    </div>
  )
}
