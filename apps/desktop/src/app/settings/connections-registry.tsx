import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Globe, Monitor, Terminal, Plus, Trash2, Check, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Pill } from '@/app/settings/primitives'
import {
  $connectionsRegistry,
  $connectionsLoading,
  loadConnectionsRegistry,
  saveConnection,
  removeConnection,
  setPrimaryConnection,
  probeConnection,
  newConnection,
  type Connection
} from '@/store/connections'

const KIND_ICONS = {
  local: Monitor,
  remote: Globe,
  ssh: Terminal
}

const KIND_LABELS = {
  local: 'Local',
  remote: 'Remote API',
  ssh: 'SSH'
}

export function ConnectionsRegistryPanel() {
  const registry = useStore($connectionsRegistry)
  const loading = useStore($connectionsLoading)
  const [editing, setEditing] = useState<Connection | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<{ reachable: boolean; error?: string } | null>(null)

  useEffect(() => {
    void loadConnectionsRegistry()
  }, [])

  const startNew = (kind: Connection['kind']) => {
    setEditing(newConnection(kind))
    setIsNew(true)
    setProbeResult(null)
  }

  const startEdit = (connection: Connection) => {
    setEditing({ ...connection })
    setIsNew(false)
    setProbeResult(null)
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsNew(false)
    setProbeResult(null)
  }

  const save = async () => {
    if (!editing) return
    if (!editing.label.trim()) return

    const success = await saveConnection(editing)
    if (success) {
      setEditing(null)
      setIsNew(false)
      setProbeResult(null)
    }
  }

  const probe = async () => {
    if (!editing?.url) return
    setProbing(true)
    setProbeResult(null)
    const result = await probeConnection(editing.url)
    setProbeResult({ reachable: result.reachable, error: result.error })
    setProbing(false)
  }

  const remove = async (id: string) => {
    await removeConnection(id)
  }

  const setPrimary = async (id: string) => {
    await setPrimaryConnection(id)
  }

  if (loading) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Add buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => startNew('remote')} size="sm" variant="text">
          <Plus className="size-3.5 mr-1" />
          Add Remote
        </Button>
        <Button onClick={() => startNew('ssh')} size="sm" variant="text">
          <Plus className="size-3.5 mr-1" />
          Add SSH
        </Button>
      </div>

      {/* Connections list */}
      {registry.connections.length === 0 && !editing && (
        <p className="px-1 py-4 text-center text-sm text-muted-foreground">
          No connections configured. Add a remote API or SSH connection.
        </p>
      )}

      {registry.connections.map(connection => {
        const Icon = KIND_ICONS[connection.kind]
        return (
          <div
            key={connection.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-colors',
              connection.isPrimary
                ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary)'
                : 'border-(--ui-stroke-tertiary)'
            )}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{connection.label}</span>
                <Pill tone="muted">{KIND_LABELS[connection.kind]}</Pill>
                {connection.isPrimary && (
                  <Pill tone="primary">
                    <Check className="size-3" />
                    Primary
                  </Pill>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {connection.url || connection.host || 'Local backend'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {!connection.isPrimary && (
                <Button onClick={() => setPrimary(connection.id)} size="sm" variant="text">
                  Set Primary
                </Button>
              )}
              <Button onClick={() => startEdit(connection)} size="sm" variant="text">
                Edit
              </Button>
              <Button onClick={() => remove(connection.id)} size="sm" variant="text" className="text-destructive">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        )
      })}

      {/* Editor */}
      {editing && (
        <div className="rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) p-4 space-y-3">
          <h4 className="text-sm font-medium">{isNew ? 'Add Connection' : 'Edit Connection'}</h4>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Label</label>
            <Input
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="My Remote API"
              value={editing.label}
            />
          </div>

          {editing.kind === 'remote' && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">API URL</label>
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  value={editing.url || ''}
                />
                <Button onClick={probe} disabled={probing || !editing.url} size="sm" variant="text">
                  {probing ? <Loader2 className="size-3.5 animate-spin" /> : 'Test'}
                </Button>
              </div>
              {probeResult && (
                <p className={cn('text-xs', probeResult.reachable ? 'text-green-500' : 'text-destructive')}>
                  {probeResult.reachable ? 'Reachable' : probeResult.error || 'Not reachable'}
                </p>
              )}
            </div>
          )}

          {editing.kind === 'ssh' && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Host</label>
              <Input
                onChange={(e) => setEditing({ ...editing, host: e.target.value })}
                placeholder="user@hostname:22"
                value={editing.host || ''}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={save} size="sm" disabled={!editing.label.trim()}>
              Save
            </Button>
            <Button onClick={cancelEdit} size="sm" variant="text">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
