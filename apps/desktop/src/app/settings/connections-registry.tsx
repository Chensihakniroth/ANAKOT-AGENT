import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DesktopAuthProvider, DesktopConnectionProbeResult } from '@/global'
import { useI18n } from '@/i18n'
import {
  AlertCircle,
  Check,
  Cpu,
  FileText,
  Globe,
  Loader2,
  LogIn,
  Monitor,
  Plus,
  Terminal,
  Trash2,
  X,
  Zap
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $profiles, refreshActiveProfile } from '@/store/profile'
import { SectionHeading, SettingsContent, Pill } from './primitives'
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

type Mode = 'local' | 'remote'
type AuthMode = 'oauth' | 'token'
type ProbeStatus = 'idle' | 'probing' | 'done' | 'error'

interface GatewayState {
  envOverride: boolean
  mode: Mode
  remoteAuthMode: AuthMode
  remoteOauthConnected: boolean
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}

const EMPTY_STATE: GatewayState = {
  envOverride: false,
  mode: 'local',
  remoteAuthMode: 'token',
  remoteOauthConnected: false,
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: ''
}

const KIND_ICONS: Record<string, typeof Globe> = {
  local: Monitor,
  remote: Globe,
  ssh: Terminal
}

export function ConnectionsRegistryPanel() {
  const { t } = useI18n()
  const g = t.settings.gateway
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [state, setState] = useState<GatewayState>(EMPTY_STATE)
  const [remoteToken, setRemoteToken] = useState('')
  const [lastTest, setLastTest] = useState<null | string>(null)

  // Connections store
  const registry = useStore($connectionsRegistry)
  const connectionsLoading = useStore($connectionsLoading)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [isNewConnection, setIsNewConnection] = useState(false)
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<{ reachable: boolean; error?: string } | null>(null)

  const [scope, setScope] = useState<null | string>(null)
  const profiles = useStore($profiles)

  const [probeStatus, setProbeStatus] = useState<ProbeStatus>('idle')
  const [probe, setProbe] = useState<DesktopConnectionProbeResult | null>(null)
  const probeSeq = useRef(0)

  useEffect(() => {
    void refreshActiveProfile()
    void loadConnectionsRegistry()
  }, [])

  // Load gateway config
  useEffect(() => {
    let cancelled = false
    const desktop = window.anakotDesktop

    if (!desktop?.getConnectionConfig) {
      setLoading(false)
      return () => void (cancelled = true)
    }

    setLoading(true)
    setRemoteToken('')
    setLastTest(null)

    desktop
      .getConnectionConfig(scope)
      .then(config => {
        if (cancelled) return
        setState(config)
      })
      .catch(err => notifyError(err, g?.failedLoad ?? 'Failed to load'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => void (cancelled = true)
  }, [scope])

  // Debounced probe
  const trimmedUrl = state.remoteUrl.trim()
  useEffect(() => {
    if (state.mode !== 'remote' || !trimmedUrl || !/^https?:\/\//i.test(trimmedUrl)) {
      setProbeStatus('idle')
      setProbe(null)
      return
    }

    const desktop = window.anakotDesktop
    if (!desktop?.probeConnectionConfig) return

    const seq = ++probeSeq.current
    setProbeStatus('probing')

    const timer = setTimeout(() => {
      desktop
        .probeConnectionConfig(trimmedUrl)
        .then(result => {
          if (seq !== probeSeq.current) return
          setProbe(result)
          setProbeStatus(result.reachable ? 'done' : 'error')
        })
        .catch(() => {
          if (seq !== probeSeq.current) return
          setProbe(null)
          setProbeStatus('error')
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [state.mode, trimmedUrl])

  const authMode: AuthMode = useMemo(() => {
    if (probeStatus === 'done' && probe && probe.authMode !== 'unknown') {
      return probe.authMode
    }
    return state.remoteAuthMode
  }, [probe, probeStatus, state.remoteAuthMode])

  const hasSavedRemote = state.remoteTokenSet || state.remoteOauthConnected
  const authResolved = useMemo(() => {
    if (probeStatus === 'done') return true
    return probeStatus === 'idle' && hasSavedRemote
  }, [probeStatus, hasSavedRemote])

  const providerLabel = useMemo(() => {
    const providers: DesktopAuthProvider[] = probe?.providers ?? []
    if (providers.length === 1) return providers[0].displayName || providers[0].name
    if (providers.length > 1) return providers.map(p => p.displayName || p.name).join(' / ')
    return t.boot.failure.identityProvider
  }, [probe, t.boot.failure.identityProvider])

  const isPasswordProvider = useMemo(() => {
    const providers: DesktopAuthProvider[] = probe?.providers ?? []
    return providers.length > 0 && providers.every(p => p.supportsPassword)
  }, [probe])

  const oauthConnected = state.remoteOauthConnected
  const canUseRemote = useMemo(() => {
    if (!trimmedUrl) return false
    if (authMode === 'oauth') return oauthConnected
    return Boolean(remoteToken.trim()) || state.remoteTokenSet
  }, [authMode, oauthConnected, remoteToken, state.remoteTokenSet, trimmedUrl])

  const namedProfiles = useMemo(() => profiles.filter(p => p.name !== 'default'), [profiles])

  const payload = () => ({
    mode: state.mode,
    profile: scope ?? undefined,
    remoteAuthMode: authMode,
    remoteToken: authMode === 'token' ? remoteToken.trim() || undefined : undefined,
    remoteUrl: trimmedUrl
  })

  const save = async (apply: boolean) => {
    if (state.mode === 'remote' && !canUseRemote) {
      notify({
        kind: 'warning',
        title: g?.incompleteTitle ?? 'Incomplete',
        message: authMode === 'oauth' ? (g?.incompleteSignIn ?? 'Sign in first') : (g?.incompleteToken ?? 'Enter a token')
      })
      return
    }

    setSaving(true)
    try {
      const next = apply
        ? await window.anakotDesktop.applyConnectionConfig(payload())
        : await window.anakotDesktop.saveConnectionConfig(payload())
      setState(next)
      setRemoteToken('')
      notify({ kind: 'success', title: apply ? (g?.restartingTitle ?? 'Restarting') : (g?.savedTitle ?? 'Saved'), message: '' })
    } catch (err) {
      notifyError(err, apply ? (g?.applyFailed ?? 'Apply failed') : (g?.saveFailed ?? 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const signIn = async () => {
    if (!trimmedUrl) return
    setSigningIn(true)
    try {
      const saved = await window.anakotDesktop.saveConnectionConfig({
        mode: state.mode,
        profile: scope ?? undefined,
        remoteAuthMode: 'oauth',
        remoteUrl: trimmedUrl
      })
      setState(saved)
      const result = await window.anakotDesktop.oauthLoginConnectionConfig(trimmedUrl)
      if (result.connected) {
        const refreshed = await window.anakotDesktop.getConnectionConfig(scope)
        setState(refreshed)
        notify({ kind: 'success', title: g?.signedIn ?? 'Signed in', message: '' })
      }
    } catch (err) {
      notifyError(err, g?.signInFailed ?? 'Sign in failed')
    } finally {
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    setSigningIn(true)
    try {
      await window.anakotDesktop.oauthLogoutConnectionConfig(trimmedUrl || undefined)
      const refreshed = await window.anakotDesktop.getConnectionConfig(scope)
      setState(refreshed)
      notify({ kind: 'success', title: g?.signedOutTitle ?? 'Signed out', message: '' })
    } catch (err) {
      notifyError(err, g?.signOutFailed ?? 'Sign out failed')
    } finally {
      setSigningIn(false)
    }
  }

  const testRemote = async () => {
    if (!canUseRemote) return
    setTesting(true)
    setLastTest(null)
    try {
      const result = await window.anakotDesktop.testConnectionConfig({
        mode: 'remote',
        profile: scope ?? undefined,
        remoteAuthMode: authMode,
        remoteToken: authMode === 'token' ? remoteToken.trim() || undefined : undefined,
        remoteUrl: trimmedUrl
      })
      const message = `${result.baseUrl}${result.version ? ` • v${result.version}` : ''}`
      setLastTest(message)
      notify({ kind: 'success', title: g?.reachableTitle ?? 'Reachable', message })
    } catch (err) {
      notifyError(err, g?.testFailed ?? 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  // Connection management
  const startNewConnection = (kind: Connection['kind']) => {
    setEditingConnection(newConnection(kind))
    setIsNewConnection(true)
    setProbeResult(null)
  }

  const startEditConnection = (connection: Connection) => {
    setEditingConnection({ ...connection })
    setIsNewConnection(false)
    setProbeResult(null)
  }

  const cancelEditConnection = () => {
    setEditingConnection(null)
    setIsNewConnection(false)
    setProbeResult(null)
  }

  const saveConnectionHandler = async () => {
    if (!editingConnection?.label.trim()) return
    const success = await saveConnection(editingConnection)
    if (success) {
      setEditingConnection(null)
      setIsNewConnection(false)
    }
  }

  const probeConnectionHandler = async () => {
    if (!editingConnection?.url) return
    setProbing(true)
    setProbeResult(null)
    const result = await probeConnection(editingConnection.url)
    setProbeResult({ reachable: result.reachable, error: result.error })
    setProbing(false)
  }

  if (loading) return null

  if (!window.anakotDesktop?.getConnectionConfig) {
    return (
      <SettingsContent>
        <div className="rounded-xl border border-border/40 bg-(--ui-bg-elevated) p-8 text-center">
          <p className="text-sm text-(--ui-text-secondary)">Gateway connection unavailable</p>
        </div>
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      <div className="space-y-6">
        {/* ── Active Status ──────────────────────────────── */}
        {registry.activeId && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Zap className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Active Connection</div>
                <div className="truncate text-xs text-(--ui-text-secondary)">
                  {registry.connections.find(c => c.id === registry.activeId)?.label || 'Local'}
                </div>
              </div>
              <Check className="size-4 text-primary" />
            </div>
          </div>
        )}

        {/* ── Profile Scope ─────────────────────────────── */}
        {namedProfiles.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-(--ui-text-secondary)">
              {g?.appliesTo ?? 'Applies to'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setScope(null)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition',
                  scope === null
                    ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) text-foreground'
                    : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
                )}
              >
                {g?.allProfiles ?? 'All profiles'}
              </button>
              {namedProfiles.map(profile => (
                <button
                  key={profile.name}
                  onClick={() => setScope(profile.name)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition',
                    scope === profile.name
                      ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) text-foreground'
                      : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
                  )}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Mode Selection ────────────────────────────── */}
        <div>
          <SectionHeading icon={Globe} title="Connection Mode" />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setState(s => ({ ...s, mode: 'local' }))}
              disabled={state.envOverride}
              className={cn(
                'rounded-xl border p-4 text-left transition',
                state.mode === 'local'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/40 hover:border-border hover:bg-(--ui-bg-tertiary)',
                state.envOverride && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Monitor className={cn('size-4', state.mode === 'local' ? 'text-primary' : 'text-(--ui-text-tertiary)')} />
                <span>{g?.localTitle ?? 'Local'}</span>
                {state.mode === 'local' && <Check className="ml-auto size-4 text-primary" />}
              </div>
              <p className="mt-1.5 text-xs text-(--ui-text-tertiary)">
                {g?.localDesc ?? 'Run the backend on this machine'}
              </p>
            </button>

            <button
              onClick={() => setState(s => ({ ...s, mode: 'remote' }))}
              disabled={state.envOverride}
              className={cn(
                'rounded-xl border p-4 text-left transition',
                state.mode === 'remote'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/40 hover:border-border hover:bg-(--ui-bg-tertiary)',
                state.envOverride && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className={cn('size-4', state.mode === 'remote' ? 'text-primary' : 'text-(--ui-text-tertiary)')} />
                <span>{g?.remoteTitle ?? 'Remote'}</span>
                {state.mode === 'remote' && <Check className="ml-auto size-4 text-primary" />}
              </div>
              <p className="mt-1.5 text-xs text-(--ui-text-tertiary)">
                {g?.remoteDesc ?? 'Connect to a remote Anakot gateway server'}
              </p>
            </button>
          </div>
        </div>

        {/* ── Remote Configuration ──────────────────────── */}
        {state.mode === 'remote' && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-(--ui-bg-elevated) p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">
                {g?.remoteUrlTitle ?? 'Gateway URL'}
              </label>
              <Input
                disabled={state.envOverride}
                onChange={e => setState(s => ({ ...s, remoteUrl: e.target.value }))}
                placeholder="https://gateway.example.com/anakot"
                value={state.remoteUrl}
              />
            </div>

            {/* Probe status */}
            {probeStatus === 'probing' && (
              <div className="flex items-center gap-2 text-xs text-(--ui-text-tertiary)">
                <Loader2 className="size-3 animate-spin" />
                <span>{g?.probing ?? 'Probing...'}</span>
              </div>
            )}
            {probeStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="size-3" />
                <span>{g?.probeError ?? 'Could not probe'}</span>
              </div>
            )}

            {/* Auth section */}
            {authResolved && authMode === 'oauth' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">
                  {g?.authTitle ?? 'Authentication'}
                </label>
                {oauthConnected ? (
                  <div className="flex items-center gap-2">
                    <Pill tone="primary">
                      <Check className="size-3" /> {g?.signedIn ?? 'Signed in'}
                    </Pill>
                    <Button disabled={signingIn || state.envOverride} onClick={() => void signOut()} size="xs" variant="outline">
                      {signingIn ? <Loader2 className="animate-spin" /> : null}
                      {g?.signOut ?? 'Sign out'}
                    </Button>
                  </div>
                ) : (
                  <Button disabled={signingIn || state.envOverride || !trimmedUrl} onClick={() => void signIn()} size="xs">
                    {signingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
                    {isPasswordProvider ? (g?.signIn ?? 'Sign in') : (g?.signInWith?.(providerLabel) ?? `Sign in with ${providerLabel}`)}
                  </Button>
                )}
              </div>
            )}

            {authResolved && authMode === 'token' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">
                  {g?.tokenTitle ?? 'Session Token'}
                </label>
                <Input
                  autoComplete="off"
                  disabled={state.envOverride}
                  onChange={e => setRemoteToken(e.target.value)}
                  placeholder={state.remoteTokenSet ? '•••••••• (saved)' : (g?.pasteSessionToken ?? 'Paste session token')}
                  type="password"
                  value={remoteToken}
                />
              </div>
            )}

            {/* Test result */}
            {lastTest && (
              <div className="text-xs text-primary">{lastTest}</div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                disabled={state.envOverride || testing || !canUseRemote}
                onClick={() => void testRemote()}
                size="xs"
                variant="text"
              >
                {testing ? <Loader2 className="animate-spin" /> : null}
                {g?.testRemote ?? 'Test'}
              </Button>
              <div className="ml-auto flex gap-2">
                <Button disabled={state.envOverride || saving} onClick={() => void save(false)} size="xs" variant="text">
                  {g?.saveForRestart ?? 'Save'}
                </Button>
                <Button disabled={state.envOverride || saving} onClick={() => void save(true)} size="xs">
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  {g?.saveAndReconnect ?? 'Save & Reconnect'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Saved Connections ─────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeading icon={Cpu} title="Saved Connections" />
            <Button onClick={() => startNewConnection('remote')} size="xs" variant="text">
              <Plus className="size-3 mr-1" />
              Add
            </Button>
          </div>

          {!connectionsLoading && registry.connections.length === 0 && !editingConnection && (
            <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
              <Globe className="mx-auto mb-2 size-6 text-(--ui-text-quaternary)" />
              <p className="text-sm font-medium text-(--ui-text-secondary)">No saved connections</p>
              <p className="mb-3 text-xs text-(--ui-text-tertiary)">Add remote servers for quick switching</p>
              <Button onClick={() => startNewConnection('remote')} size="xs" variant="text">
                <Plus className="size-3 mr-1" />
                Add Connection
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {registry.connections.map(connection => {
              const Icon = KIND_ICONS[connection.kind] || Globe
              const isActive = connection.id === registry.activeId
              return (
                <div
                  key={connection.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border p-3 transition-all',
                    isActive
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/40 hover:border-border hover:bg-(--ui-bg-tertiary)'
                  )}
                >
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    isActive ? 'bg-primary/10' : 'bg-(--ui-bg-elevated)'
                  )}>
                    <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-(--ui-text-tertiary)')} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{connection.label}</span>
                      {connection.isPrimary && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-primary">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-(--ui-text-tertiary)">
                      {connection.url || connection.host || 'Local'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!connection.isPrimary && (
                      <Button onClick={() => setPrimaryConnection(connection.id)} size="xs" variant="text">
                        Primary
                      </Button>
                    )}
                    <Button onClick={() => startEditConnection(connection)} size="xs" variant="text">
                      Edit
                    </Button>
                    <Button onClick={() => removeConnection(connection.id)} size="xs" variant="text" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Connection Editor ─────────────────────────── */}
        {editingConnection && (
          <div className="rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-5">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="size-4 text-(--ui-text-secondary)" />
              <h4 className="text-sm font-medium">
                {isNewConnection ? 'Add Connection' : 'Edit Connection'}
              </h4>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">Label</label>
                <Input
                  onChange={e => setEditingConnection({ ...editingConnection, label: e.target.value })}
                  placeholder="My Remote Server"
                  value={editingConnection.label}
                />
              </div>

              {editingConnection.kind === 'remote' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">API URL</label>
                  <div className="flex gap-2">
                    <Input
                      onChange={e => setEditingConnection({ ...editingConnection, url: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      value={editingConnection.url || ''}
                    />
                    <Button onClick={probeConnectionHandler} disabled={probing || !editingConnection.url} size="sm" variant="outline">
                      {probing ? <Loader2 className="size-3.5 animate-spin" /> : 'Test'}
                    </Button>
                  </div>
                  {probeResult && (
                    <div className={cn('mt-2 flex items-center gap-1.5 text-xs', probeResult.reachable ? 'text-green-500' : 'text-destructive')}>
                      {probeResult.reachable ? <Check className="size-3" /> : <X className="size-3" />}
                      <span>{probeResult.reachable ? 'Reachable' : probeResult.error || 'Not reachable'}</span>
                    </div>
                  )}
                </div>
              )}

              {editingConnection.kind === 'ssh' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-(--ui-text-secondary)">Host</label>
                  <Input
                    onChange={e => setEditingConnection({ ...editingConnection, host: e.target.value })}
                    placeholder="user@hostname:22"
                    value={editingConnection.host || ''}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={saveConnectionHandler} size="sm" disabled={!editingConnection.label.trim()}>
                  {isNewConnection ? 'Add' : 'Save'}
                </Button>
                <Button onClick={cancelEditConnection} size="sm" variant="text">Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Diagnostics ───────────────────────────────── */}
        <div className="flex items-center justify-end border-t border-border/30 pt-4">
          <Button onClick={() => void window.anakotDesktop?.revealLogs()} size="xs" variant="text">
            <FileText />
            {g?.openLogs ?? 'Open Logs'}
          </Button>
        </div>
      </div>
    </SettingsContent>
  )
}
