import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Globe, RefreshCw, Trash2 } from '@/lib/icons'

import { ListRow, SectionHeading, SettingsContent } from './primitives'

interface WebhookRoute {
  deliver: string
  enabled: boolean
  events: string[]
  name: string
  secret?: string
  secret_set: boolean
  url: string
}

interface WebhooksResponse {
  base_url: string
  enabled: boolean
  subscriptions: WebhookRoute[]
}

export function WebhooksSettings() {
  const [data, setData] = useState<WebhooksResponse | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [events, setEvents] = useState('')
  const [deliver, setDeliver] = useState('log')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdSecret, setCreatedSecret] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const next = await window.anakotDesktop.api<WebhooksResponse>({ path: '/api/webhooks' })
      setData(next)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const created = await window.anakotDesktop.api<WebhookRoute>({
        path: '/api/webhooks',
        method: 'POST',
        body: {
          name: trimmed,
          description: description.trim() || undefined,
          events: events.split(',').map(event => event.trim()).filter(Boolean),
          deliver
        }
      })
      setCreatedSecret(created.secret ?? '')
      setName('')
      setDescription('')
      setEvents('')
      setDeliver('log')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (route: WebhookRoute, enabled: boolean) => {
    await window.anakotDesktop.api({
      path: `/api/webhooks/${encodeURIComponent(route.name)}/enabled`,
      method: 'PUT',
      body: { enabled }
    })
    await refresh()
  }

  const remove = async (route: WebhookRoute) => {
    if (!window.confirm(`Delete webhook "${route.name}"?`)) return
    await window.anakotDesktop.api({ path: `/api/webhooks/${encodeURIComponent(route.name)}`, method: 'DELETE' })
    await refresh()
  }

  return (
    <SettingsContent>
      <div className="space-y-1 divide-y divide-border/30">
        <SectionHeading icon={Globe} title="Webhooks" />
        <ListRow
          action={<Button disabled={loading} onClick={() => void refresh()} size="icon" variant="ghost"><RefreshCw className="size-4" /></Button>}
          description={data?.enabled ? `Endpoint base: ${data.base_url}` : 'Enable the Webhook platform in Messaging settings first.'}
          title="Webhook subscriptions"
        />
        {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 px-3 py-3">
          <Input aria-label="Webhook name" onChange={event => setName(event.target.value)} placeholder="webhook-name" value={name} />
          <Button disabled={saving || !data?.enabled || !name.trim()} onClick={() => void create()}>Create</Button>
        </div>
        <div className="grid gap-2 px-3 py-3 sm:grid-cols-3">
          <Input aria-label="Description" onChange={event => setDescription(event.target.value)} placeholder="Description" value={description} />
          <Input aria-label="Events" onChange={event => setEvents(event.target.value)} placeholder="Events, comma separated" value={events} />
          <Input aria-label="Delivery target" onChange={event => setDeliver(event.target.value)} placeholder="Delivery target" value={deliver} />
        </div>
        {createdSecret && <div className="px-3 py-3 text-xs text-amber-600">Copy this secret now: <code className="font-mono">{createdSecret}</code></div>}
        {(data?.subscriptions ?? []).map(route => (
          <div className="flex items-center gap-3 px-3 py-3" key={route.name}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{route.name}</div>
              <button
                className="block max-w-full truncate text-left font-mono text-[0.7rem] text-muted-foreground hover:text-foreground"
                onClick={() => void navigator.clipboard?.writeText(route.url)}
                title="Copy webhook URL"
                type="button"
              >
                {route.url}
              </button>
            </div>
            <Switch checked={route.enabled} onCheckedChange={enabled => void toggle(route, enabled)} />
            <Button aria-label={`Delete ${route.name}`} onClick={() => void remove(route)} size="icon" variant="ghost"><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </SettingsContent>
  )
}
