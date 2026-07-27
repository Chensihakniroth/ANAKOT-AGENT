import { useCallback, useEffect, useMemo, useState } from 'react'

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
import type { AnakotConfigRecord } from '@/types/anakot'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize API response — backend may return object or array. */
function normalizeUsers(raw: unknown): UserMeta[] {
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  if (Array.isArray(data.users)) return data.users as UserMeta[]
  if (data.users && typeof data.users === 'object' && !Array.isArray(data.users)) {
    return Object.entries(data.users).map(([id, meta]: [string, unknown]) => ({
      user_id: id,
      ...(meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}),
    })) as UserMeta[]
  }
  return []
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
      const [userData, configData] = await Promise.all([
        api<{ users?: unknown }>({ path: '/api/admin/users' }).catch(() => null),
        api<AnakotConfigRecord>({ path: '/api/config' }).catch(() => null),
      ])

      setUsers(normalizeUsers(userData))

      // Extract MCP servers from full config
      const cfg = configData as Record<string, unknown> | null
      const mcpServers = cfg?.mcp_servers
      if (mcpServers && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
        setMcpList(
          Object.entries(mcpServers as Record<string, Record<string, unknown>>).map(([name, srv]) => ({
            name,
            transport: (srv.transport as string) || 'stdio',
          })),
        )
      } else {
        setMcpList([])
      }

      // Available toolsets — extract from config
      const toolsets = cfg?.toolsets
      if (Array.isArray(toolsets)) {
        setToolsetList(
          (toolsets as unknown[]).map(ts => ({
            name: typeof ts === 'string' ? ts : (ts as Record<string, unknown>)?.name as string ?? 'unknown',
            enabled: true,
          })),
        )
      } else {
        setToolsetList([])
      }
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
  const selectedUser = useMemo(
    () => users.find(u => u.user_id === selectedUserId),
    [users, selectedUserId],
  )

  useEffect(() => {
    if (!selectedUser) {
      setAllowedMcp(new Set())
      setAllowedToolsets(new Set())
      setRestrictMcp(false)
      setRestrictToolsets(false)
      setDirty(false)
      return
    }

    const mcp = selectedUser.metadata?.allowed_mcp
    const toolsets = selectedUser.metadata?.allowed_toolsets

    setRestrictMcp(mcp !== undefined && mcp !== null)
    setRestrictToolsets(toolsets !== undefined && toolsets !== null)
    setAllowedMcp(new Set(mcp ?? []))
    setAllowedToolsets(new Set(toolsets ?? []))
    setDirty(false)
  }, [selectedUser])

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
      {/* User selector */}
      <SettingsSection>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Per-User Grants</span>
        </div>

        <div className="max-w-sm">
          <label className="mb-1.5 block text-xs text-muted-foreground">Select user</label>
          <Select onValueChange={v => setSelectedUserId(v)} value={selectedUserId}>
            <SelectTrigger className="h-8 text-xs">
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
            <div className="mb-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={restrictMcp}
                  onCheckedChange={v => {
                    setRestrictMcp(!!v)
                    setDirty(true)
                  }}
                />
                <span>Restrict MCP servers</span>
              </label>
              <p className="mt-1 ml-6 text-[0.7rem] text-muted-foreground/60">
                {restrictMcp
                  ? mcpList.length > 0
                    ? `Select which of the ${mcpList.length} configured servers this user can access`
                    : 'No MCP servers configured yet'
                  : 'User has access to all MCP servers'}
              </p>
            </div>

            {restrictMcp && mcpList.length > 0 && (
              <div className="ml-6 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {mcpList.map(mcp => (
                  <label
                    key={mcp.name}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/30 px-2.5 py-2 transition-colors hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={allowedMcp.has(mcp.name)}
                      onCheckedChange={() => toggleMcp(mcp.name)}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">{mcp.name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                      {mcp.transport}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* ── Toolset Grants ─────────────────────────────────────────── */}
          <SettingsSection>
            <div className="mb-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={restrictToolsets}
                  onCheckedChange={v => {
                    setRestrictToolsets(!!v)
                    setDirty(true)
                  }}
                />
                <span>Restrict tool backends</span>
              </label>
              <p className="mt-1 ml-6 text-[0.7rem] text-muted-foreground/60">
                {restrictToolsets
                  ? toolsetList.length > 0
                    ? `Select which of the ${toolsetList.length} configured backends this user can access`
                    : 'No tool backends configured yet'
                  : 'User has access to all tool backends'}
              </p>
            </div>

            {restrictToolsets && toolsetList.length > 0 && (
              <div className="ml-6 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {toolsetList.map(ts => (
                  <label
                    key={ts.name}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/30 px-2.5 py-2 transition-colors hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={allowedToolsets.has(ts.name)}
                      onCheckedChange={() => toggleToolset(ts.name)}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">{ts.name}</span>
                  </label>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* ── Save ─────────────────────────────────────────────────── */}
          <SettingsSection>
            <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/15 px-4 py-3">
              <Button
                disabled={!dirty || saving}
                onClick={() => void saveGrants()}
                size="sm"
              >
                {saving ? 'Saving…' : 'Save Grants'}
              </Button>
              {dirty && (
                <span className="text-xs text-amber-500 dark:text-amber-400">Unsaved changes</span>
              )}
              {!dirty && selectedUser && (
                <span className="text-xs text-muted-foreground/50">
                  {(selectedUser.metadata?.allowed_mcp?.length ?? 0) +
                    (selectedUser.metadata?.allowed_toolsets?.length ?? 0) > 0
                    ? 'Restricted access configured'
                    : 'Full access (no restrictions)'}
                </span>
              )}
            </div>
          </SettingsSection>
        </>
      )}
    </SettingsContent>
  )
}
