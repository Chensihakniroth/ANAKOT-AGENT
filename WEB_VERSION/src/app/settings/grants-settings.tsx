import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorState } from '@/components/ui/error-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { ShieldCheck } from '@/lib/icons'
import { api } from '@/lib/web-anakot-desktop'
import { notify, notifyError } from '@/store/notifications'

import { EmptyState, LoadingState, SettingsContent, SettingsSection } from './primitives'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserMeta {
  user_id: string
  display_name?: string
  role?: string
  metadata?: {
    allowed_mcp?: string[] | null
    allowed_toolsets?: string[] | null
  }
}

interface McpInfo {
  name: string
  transport: string
}

interface ToolsetInfo {
  name: string
  enabled: boolean
}

interface GrantsPayload {
  allowed_mcp: string[] | null
  allowed_toolsets: string[] | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GrantsSettings() {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserMeta[]>([])
  const [mcpList, setMcpList] = useState<McpInfo[]>([])
  const [toolsetList, setToolsetList] = useState<ToolsetInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selected user
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Current grants for the selected user
  const [allowedMcp, setAllowedMcp] = useState<Set<string>>(new Set())
  const [allowedToolsets, setAllowedToolsets] = useState<Set<string>>(new Set())
  const [restrictMcp, setRestrictMcp] = useState(false)
  const [restrictToolsets, setRestrictToolsets] = useState(false)

  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [userData, mcpData, toolsetData] = await Promise.all([
        api<{ users: UserMeta[] }>({ path: '/api/admin/users' }),
        api<{ mcp_servers: Record<string, { transport: string }> }>({ path: '/api/mcp/list' }).catch(
          () => ({ mcp_servers: {} }),
        ),
        api<ToolsetInfo[]>({ path: '/api/tools/toolsets' }).catch(() => [] as ToolsetInfo[]),
      ])

      setUsers(userData.users ?? [])
      setMcpList(
        Object.entries(mcpData.mcp_servers ?? {}).map(([name, srv]) => ({
          name,
          transport: srv.transport || 'stdio',
        })),
      )
      setToolsetList(Array.isArray(toolsetData) ? toolsetData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // When user selection changes, load their grants
  useEffect(() => {
    const user = users.find(u => u.user_id === selectedUserId)
    if (!user) {
      setAllowedMcp(new Set())
      setAllowedToolsets(new Set())
      setRestrictMcp(false)
      setRestrictToolsets(false)
      setDirty(false)
      return
    }

    const mcp = user.metadata?.allowed_mcp
    const toolsets = user.metadata?.allowed_toolsets

    setRestrictMcp(mcp !== undefined && mcp !== null)
    setRestrictToolsets(toolsets !== undefined && toolsets !== null)
    setAllowedMcp(new Set(mcp ?? []))
    setAllowedToolsets(new Set(toolsets ?? []))
    setDirty(false)
  }, [selectedUserId, users])

  const toggleMcp = useCallback(
    (name: string) => {
      setAllowedMcp(prev => {
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setDirty(true)
        return next
      })
    },
    [],
  )

  const toggleToolset = useCallback(
    (name: string) => {
      setAllowedToolsets(prev => {
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setDirty(true)
        return next
      })
    },
    [],
  )

  const saveGrants = useCallback(async () => {
    if (!selectedUserId) return
    setSaving(true)
    try {
      const payload: GrantsPayload = {
        allowed_mcp: restrictMcp ? (allowedMcp.size > 0 ? [...allowedMcp] : []) : null,
        allowed_toolsets: restrictToolsets
          ? allowedToolsets.size > 0
            ? [...allowedToolsets]
            : []
          : null,
      }
      await api({
        path: `/api/admin/users/${encodeURIComponent(selectedUserId)}/grants`,
        method: 'POST',
        body: payload,
      })
      notify({ message: 'Grants saved' })
      setDirty(false)
      void loadAll()
    } catch (err) {
      notifyError(err, 'Failed to save grants')
    } finally {
      setSaving(false)
    }
  }, [selectedUserId, restrictMcp, restrictToolsets, allowedMcp, allowedToolsets, loadAll])

  const selectedUser = users.find(u => u.user_id === selectedUserId)

  if (loading) {
    return <LoadingState label="Loading grants data…" />
  }

  if (error) {
    return (
      <SettingsContent>
        <ErrorState title="Failed to load data" description={error}>
          <Button className="h-7 text-xs" onClick={() => void loadAll()} size="sm" variant="outline">
            Retry
          </Button>
        </ErrorState>
      </SettingsContent>
    )
  }

  if (users.length === 0) {
    return (
      <SettingsContent>
        <EmptyState title="No users" description="No users have registered yet." />
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      <SettingsSection>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Per-User Grants</span>
        </div>

        <div className="max-w-sm">
          <label className="mb-1 block text-xs text-muted-foreground">Select user</label>
          <Select onValueChange={v => setSelectedUserId(v)} value={selectedUserId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="— Choose a user —" />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.display_name || u.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      {selectedUser && (
        <>
          {/* ── MCP Grants ───────────────────────────────────────────── */}

          <SettingsSection>
            <div className="mb-2 flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={restrictMcp}
                  onCheckedChange={v => {
                    setRestrictMcp(!!v)
                    setDirty(true)
                  }}
                />
                <span>Restrict MCP servers</span>
              </label>
            </div>

            {restrictMcp && mcpList.length > 0 && (
              <div className="ml-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {mcpList.map(mcp => (
                  <label
                    key={mcp.name}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={allowedMcp.has(mcp.name)}
                      onCheckedChange={() => toggleMcp(mcp.name)}
                    />
                    <span className="text-xs">{mcp.name}</span>
                    <span className="ml-auto text-[0.6rem] text-muted-foreground">
                      {mcp.transport}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {restrictMcp && mcpList.length === 0 && (
              <p className="ml-5 text-xs text-muted-foreground">No MCP servers configured.</p>
            )}

            {!restrictMcp && (
              <p className="ml-5 text-xs text-muted-foreground">
                User has access to all MCP servers.
              </p>
            )}
          </SettingsSection>

          {/* ── Toolset Grants ─────────────────────────────────────────── */}
          <SettingsSection>
            <div className="mb-2 flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={restrictToolsets}
                  onCheckedChange={v => {
                    setRestrictToolsets(!!v)
                    setDirty(true)
                  }}
                />
                <span>Restrict tool backends</span>
              </label>
            </div>

            {restrictToolsets && toolsetList.length > 0 && (
              <div className="ml-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {toolsetList.map(ts => (
                  <label
                    key={ts.name}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={allowedToolsets.has(ts.name)}
                      onCheckedChange={() => toggleToolset(ts.name)}
                    />
                    <span className="text-xs">{ts.name}</span>
                  </label>
                ))}
              </div>
            )}

            {restrictToolsets && toolsetList.length === 0 && (
              <p className="ml-5 text-xs text-muted-foreground">No tool backends configured.</p>
            )}

            {!restrictToolsets && (
              <p className="ml-5 text-xs text-muted-foreground">
                User has access to all tool backends.
              </p>
            )}
          </SettingsSection>

          {/* ── Save ─────────────────────────────────────────────────── */}
          <SettingsSection>
            <div className="flex items-center gap-2">
              <Button
                disabled={!dirty || saving}
                onClick={() => void saveGrants()}
                size="sm"
              >
                {saving ? 'Saving…' : 'Save Grants'}
              </Button>
              {dirty && (
                <span className="text-xs text-amber-500">Unsaved changes</span>
              )}
            </div>
          </SettingsSection>
        </>
      )}
    </SettingsContent>
  )
}
