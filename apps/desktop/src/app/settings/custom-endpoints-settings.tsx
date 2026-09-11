import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SettingsContent, SettingsSection } from '@/app/settings/primitives'
import {
  $customEndpoints,
  $customEndpointsLoading,
  loadCustomEndpoints,
  saveCustomEndpoint,
  deleteCustomEndpoint,
  activateCustomEndpoint,
  newCustomEndpoint,
  type CustomEndpoint
} from '@/store/custom-endpoints'
import { Plus, Trash2, Save, Check } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function CustomEndpointsSettings() {
  const endpoints = useStore($customEndpoints)
  const loading = useStore($customEndpointsLoading)
  const [editing, setEditing] = useState<CustomEndpoint | null>(null)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    void loadCustomEndpoints()
  }, [])

  const startNew = () => {
    setEditing(newCustomEndpoint())
    setIsNew(true)
  }

  const startEdit = (endpoint: CustomEndpoint) => {
    setEditing({ ...endpoint })
    setIsNew(false)
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsNew(false)
  }

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.base_url.trim()) return

    const success = await saveCustomEndpoint(editing)
    if (success) {
      setEditing(null)
      setIsNew(false)
    }
  }

  const remove = async (id: string) => {
    await deleteCustomEndpoint(id)
  }

  const activate = async (id: string) => {
    await activateCustomEndpoint(id)
  }

  if (loading) {
    return null
  }

  return (
    <SettingsContent>
      <div className="space-y-3">
        {endpoints.length === 0 && !editing && (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">
            No custom endpoints configured. Add one to connect to a custom API server.
          </p>
        )}

        {endpoints.map(endpoint => (
          <div
            key={endpoint.id}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              endpoint.is_current
                ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary)'
                : 'border-(--ui-stroke-tertiary)'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{endpoint.name}</span>
                  {endpoint.is_current && (
                    <span className="flex items-center gap-1 rounded-full bg-(--ui-accent-secondary)/10 px-2 py-0.5 text-[0.68rem] text-(--ui-accent-secondary)">
                      <Check className="size-3" />
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{endpoint.base_url}</p>
                {endpoint.model && (
                  <p className="text-xs text-muted-foreground/70">Model: {endpoint.model}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!endpoint.is_current && (
                  <Button onClick={() => activate(endpoint.id)} size="sm" variant="text">
                    Activate
                  </Button>
                )}
                <Button onClick={() => startEdit(endpoint)} size="sm" variant="text">
                  Edit
                </Button>
                <Button onClick={() => remove(endpoint.id)} size="sm" variant="text" className="text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {editing ? (
          <div className="rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) p-4 space-y-3">
            <h4 className="text-sm font-medium">{isNew ? 'Add Custom Endpoint' : 'Edit Endpoint'}</h4>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="My Custom API"
                value={editing.name}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Base URL</label>
              <Input
                onChange={(e) => setEditing({ ...editing, base_url: e.target.value })}
                placeholder="https://api.example.com/v1"
                value={editing.base_url}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">API Key</label>
              <Input
                onChange={(e) => setEditing({ ...editing, api_key: e.target.value })}
                placeholder="sk-..."
                type="password"
                value={editing.api_key || ''}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Model</label>
              <Input
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                placeholder="gpt-4"
                value={editing.model || ''}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Context Length</label>
              <Input
                onChange={(e) => setEditing({ ...editing, context_length: Number(e.target.value) || undefined })}
                placeholder="128000"
                type="number"
                value={editing.context_length || ''}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={editing.discover_models !== false}
                onCheckedChange={(checked) => setEditing({ ...editing, discover_models: !!checked })}
              />
              <label className="text-xs text-muted-foreground">Auto-discover models</label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={save} size="sm" disabled={!editing.name.trim() || !editing.base_url.trim()}>
                <Save className="size-3.5 mr-1" />
                Save
              </Button>
              <Button onClick={cancelEdit} size="sm" variant="text">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={startNew} size="sm" variant="text">
            <Plus className="size-3.5 mr-1" />
            Add Endpoint
          </Button>
        )}
      </div>
    </SettingsContent>
  )
}
