// SSH host selection — for remote session connections.

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SshHost {
  id: string
  name: string
  host: string
  port: number
  user: string
}

interface SshHostSelectionProps {
  hosts: SshHost[]
  selectedHostId?: string
  onSelect?: (hostId: string) => void
  onAdd?: (host: Omit<SshHost, 'id'>) => void
  onRemove?: (hostId: string) => void
  className?: string
}

export function SshHostSelection({
  hosts,
  selectedHostId,
  onSelect,
  onAdd,
  onRemove,
  className,
}: SshHostSelectionProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newHost, setNewHost] = useState({ name: '', host: '', port: 22, user: '' })

  const handleAdd = () => {
    if (!newHost.name || !newHost.host || !newHost.user) return
    onAdd?.({ ...newHost })
    setNewHost({ name: '', host: '', port: 22, user: '' })
    setShowAdd(false)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label className="text-sm font-medium">
        SSH Hosts
      </label>

      {/* Existing hosts */}
      {hosts.length > 0 && (
        <div className="space-y-1">
          {hosts.map(host => (
            <div
              key={host.id}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2 transition-colors cursor-pointer',
                selectedHostId === host.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/30',
              )}
              onClick={() => onSelect?.(host.id)}
            >
              <div>
                <p className="text-sm font-medium">{host.name}</p>
                <p className="text-xs text-muted-foreground">
                  {host.user}@{host.host}:{host.port}
                </p>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onRemove?.(host.id)
                }}
                className="text-xs text-muted-foreground hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new host form */}
      {showAdd ? (
        <div className="space-y-2 rounded-md border border-border/30 bg-muted/10 p-3">
          <Input
            placeholder="Name (e.g. Work Server)"
            value={newHost.name}
            onChange={e => setNewHost(h => ({ ...h, name: e.target.value }))}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Input
              placeholder="hostname"
              value={newHost.host}
              onChange={e => setNewHost(h => ({ ...h, host: e.target.value }))}
              className="h-8 flex-1 text-xs"
            />
            <Input
              type="number"
              placeholder="port"
              value={newHost.port}
              onChange={e => setNewHost(h => ({ ...h, port: parseInt(e.target.value) || 22 }))}
              className="h-8 w-16 text-xs"
            />
          </div>
          <Input
            placeholder="username"
            value={newHost.user}
            onChange={e => setNewHost(h => ({ ...h, user: e.target.value }))}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newHost.name || !newHost.host || !newHost.user} className="flex-1">
              Add Host
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          + Add SSH Host
        </Button>
      )}
    </div>
  )
}
