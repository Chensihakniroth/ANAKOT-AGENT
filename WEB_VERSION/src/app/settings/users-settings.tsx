import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { ShieldCheck, Trash2, Users } from '@/lib/icons'
import { api } from '@/lib/web-anakot-desktop'
import { notify, notifyError } from '@/store/notifications'

import { EmptyState, LoadingState, SettingsContent, SettingsSection } from './primitives'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserMeta {
  user_id: string
  display_name?: string
  email?: string
  role?: string
  profile?: string
  metadata?: {
    display_name?: string
    email?: string
    role?: string
    is_disabled?: boolean
    disabled_at?: string
    allowed_mcp?: string[] | null
    allowed_toolsets?: string[] | null
  }
}

interface UsersApiData {
  users?: UserMeta[] | Record<string, unknown>
  total?: number
  admin_count?: number
}

/** Normalize API response — backend may return object or array. */
function normalizeUsers(raw: UsersApiData | unknown): UserMeta[] {
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  if (Array.isArray(data.users)) return data.users as UserMeta[]
  if (data.users && typeof data.users === 'object' && !Array.isArray(data.users)) {
    // Object map { user_id: meta }
    return Object.entries(data.users).map(([id, meta]: [string, unknown]) => ({
      user_id: id,
      ...(meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}),
    })) as UserMeta[]
  }
  return []
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UsersSettings() {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserMeta | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<UsersApiData>({ path: '/api/admin/users' })
      setUsers(normalizeUsers(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const toggleDisabled = useCallback(
    async (user: UserMeta, currentlyDisabled: boolean) => {
      try {
        const action = currentlyDisabled ? 'enable' : 'disable'
        await api<{ ok: boolean }>({
          path: `/api/admin/users/${encodeURIComponent(user.user_id)}/${action}`,
          method: 'POST',
        })
        notify({ message: `User ${currentlyDisabled ? 'enabled' : 'disabled'}` })
        void loadUsers()
      } catch (err) {
        notifyError(err, `Failed to ${currentlyDisabled ? 'enable' : 'disable'} user`)
      }
    },
    [loadUsers],
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await api<{ ok: boolean }>({
        path: `/api/admin/users/${encodeURIComponent(deleteTarget.user_id)}`,
        method: 'DELETE',
      })
      notify({ message: 'User deleted' })
      setDeleteTarget(null)
      void loadUsers()
    } catch (err) {
      notifyError(err, 'Failed to delete user')
    }
  }, [deleteTarget, loadUsers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(
      u =>
        u.display_name?.toLowerCase().includes(q) ||
        u.user_id?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    )
  }, [users, search])

  if (loading) {
    return <LoadingState label="Loading users…" />
  }

  if (error) {
    return (
      <SettingsContent>
        <ErrorState title="Failed to load users" description={error}>
          <Button className="h-7 text-xs" onClick={() => void loadUsers()} size="sm" variant="outline">
            Retry
          </Button>
        </ErrorState>
      </SettingsContent>
    )
  }

  if (users.length === 0) {
    return (
      <SettingsContent>
        <EmptyState title="No users found" description="No users have registered yet." />
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      <SettingsSection>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Users</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {users.length}
            </span>
          </div>
          <Input
            className="h-7 w-48 text-xs"
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            value={search}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="px-3 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Profile</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Grants</th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isDisabled = !!u.metadata?.is_disabled
                const isAdmin = u.role === 'admin' || u.metadata?.role === 'admin'
                const grantsCount =
                  (u.metadata?.allowed_mcp?.length ?? 0) +
                  (u.metadata?.allowed_toolsets?.length ?? 0)

                return (
                  <tr key={u.user_id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="max-w-44 truncate px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isAdmin && <ShieldCheck className="size-3 shrink-0 text-amber-500" />}
                        <span className={isDisabled ? 'text-muted-foreground line-through' : ''}>
                          {u.display_name || u.user_id}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-36 truncate px-3 py-2.5 text-muted-foreground">
                      {u.email || u.metadata?.email || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                          isAdmin
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isAdmin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="max-w-28 truncate px-3 py-2.5 text-muted-foreground">
                      {u.profile || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                          isDisabled
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-green-500/10 text-green-600 dark:text-green-400'
                        }`}
                      >
                        {isDisabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {grantsCount > 0 ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-600 dark:text-amber-400">
                          {grantsCount} restricted
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">All allowed</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          className="h-6 px-2 text-[0.65rem]"
                          onClick={() => void toggleDisabled(u, isDisabled)}
                          size="sm"
                          variant={isDisabled ? 'default' : 'ghost'}
                        >
                          {isDisabled ? 'Enable' : 'Disable'}
                        </Button>
                        <Button
                          className="h-6 px-2 text-[0.65rem] text-red-500 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => setDeleteTarget(u)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && search && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No users match "{search}"
          </p>
        )}
      </SettingsSection>

      {deleteTarget && (
        <ConfirmDialog
          cancelLabel="Cancel"
          confirmLabel="Delete User"
          description={`This will permanently delete the profile and data for "${
            deleteTarget.display_name || deleteTarget.user_id
          }". This cannot be undone.`}
          destructive
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => confirmDelete()}
          open
          title="Delete User"
        />
      )}
    </SettingsContent>
  )
}
