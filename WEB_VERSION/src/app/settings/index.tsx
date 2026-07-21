import { IconDownload, IconRefresh, IconUpload } from '@tabler/icons-react'
import { useRef, useState } from 'react'

import { Tip } from '@/components/ui/tooltip'
import { getAnakotConfigDefaults, getAnakotConfigRecord, saveAnakotConfig } from '@/anakot'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import {
  Archive,
  Globe,
  Info,
  KeyRound,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  Zap,
  type IconComponent,
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Codicon } from '@/components/ui/codicon'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { notifyError } from '@/store/notifications'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlayIconButton } from '../overlays/overlay-chrome'
import { OverlayMain, OverlayNavItem, OverlaySidebar, OverlaySplitLayout } from '../overlays/overlay-split-layout'
import { OverlayView } from '../overlays/overlay-view'

import { AboutSettings } from './about-settings'
import { AppearanceSettings } from './appearance-settings'
import { ConfigSettings } from './config-settings'
import { SECTIONS } from './constants'
import { GatewaySettings } from './gateway-settings'
import { GrantsSettings } from './grants-settings'
import { KEYS_VIEWS, KeysSettings, type KeysView } from './keys-settings'
import { McpSettings } from './mcp-settings'
import { PROVIDER_VIEWS, ProvidersSettings, type ProviderView } from './providers-settings'
import { SessionsSettings } from './sessions-settings'
import { ToolsetsSettings } from './toolsets-settings'
import type { SettingsPageProps, SettingsView as SettingsViewId } from './types'
import { UsersSettings } from './users-settings'

const SETTINGS_VIEWS: readonly SettingsViewId[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsViewId),
  'providers',
  'gateway',
  'keys',
  'mcp',
  'toolsets',
  'users',
  'grants',
  'sessions',
  'about'
]

export function SettingsView({ gateway, onClose, onConfigSaved, onMainModelChanged, user }: SettingsPageProps) {
  const { t } = useI18n()
  const isMobile = useIsMobile()
  const [navSheetOpen, setNavSheetOpen] = useState(false)

  // Providers subnav (Accounts vs API keys) lives in its own param so each
  // sub-view is deep-linkable and survives a refresh.
  const [providerView, setProviderView] = useRouteEnumParam<ProviderView>('pview', PROVIDER_VIEWS, 'accounts')
  const [keysView, setKeysView] = useRouteEnumParam<KeysView>('kview', KEYS_VIEWS, 'tools')

  const openProviderView = (view: ProviderView) => {
    setActiveView('providers')
    setProviderView(view)
  }

  const openKeysView = (view: KeysView) => {
    setActiveView('keys')
    setKeysView(view)
  }

  const importInputRef = useRef<HTMLInputElement | null>(null)

  // Admin gating — hide Model, Advanced and Providers tabs from normal users.
  // The `is_admin` field comes from the auth session (/api/auth/me).
  const isAdmin = user?.is_admin ?? false
  const visibleSections = isAdmin
    ? SECTIONS
    : SECTIONS.filter(s => s.id !== 'model' && s.id !== 'advanced' && s.id !== 'memory')

  // Default to the first visible section for non-admin users,
  // since 'config:model' is hidden from them.
  const defaultTab: SettingsViewId = isAdmin
    ? 'config:model'
    : (`config:${visibleSections[0]?.id}` as SettingsViewId) || 'gateway'

  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, defaultTab)

  // ── Helpers ──────────────────────────────────────────────────────────

  const navItem = (view: SettingsViewId, label: string, icon: IconComponent, isNested = false) => (
    <OverlayNavItem
      active={activeView === view}
      icon={icon}
      label={label}
      nested={isNested}
      onClick={() => {
        setActiveView(view)
        setNavSheetOpen(false)
      }}
    />
  )

  const activeLabel = () => {
    const section = SECTIONS.find(s => `config:${s.id}` === activeView)
    if (section) return t.settings.sections[section.id] ?? section.label
    const navLabels: Record<string, string> = {
      providers: t.settings.nav.providers,
      gateway: t.settings.nav.gateway,
      keys: t.settings.nav.apiKeys,
      mcp: t.settings.nav.mcp,
      toolsets: t.settings.nav.toolsets ?? 'Tool Backends',
      users: 'Users',
      grants: 'Grants',
      sessions: t.settings.nav.archivedChats,
      about: t.settings.nav.about,
    }
    return navLabels[activeView] ?? activeView
  }

  // ── Sidebar content (shared between desktop sidebar & mobile sheet) ──

  const sidebarContent = (
    <>
      {visibleSections.map(s => {
        const view = `config:${s.id}` as SettingsViewId
        return (
          <OverlayNavItem
            active={activeView === view}
            icon={s.icon}
            key={s.id}
            label={t.settings.sections[s.id] ?? s.label}
            onClick={() => {
              setActiveView(view)
              setNavSheetOpen(false)
            }}
          />
        )
      })}
      <div className="my-2 h-px bg-border/30" />
      {isAdmin && (
        <>
          {navItem('providers', t.settings.nav.providers, Zap)}
          {activeView === 'providers' && (
            <div className="ml-3.5 flex flex-col gap-0.5 pl-1.5">
              <OverlayNavItem
                active={providerView === 'accounts'}
                icon={Sparkles}
                label={t.settings.nav.providerAccounts}
                nested
                onClick={() => {
                  openProviderView('accounts')
                  setNavSheetOpen(false)
                }}
              />
              <OverlayNavItem
                active={providerView === 'keys'}
                icon={KeyRound}
                label={t.settings.nav.providerApiKeys}
                nested
                onClick={() => {
                  openProviderView('keys')
                  setNavSheetOpen(false)
                }}
              />
            </div>
          )}
        </>
      )}
      {isAdmin && navItem('gateway', t.settings.nav.gateway, Globe)}
      {isAdmin && (
        <>
          {navItem('keys', t.settings.nav.apiKeys, KeyRound)}
          {activeView === 'keys' && (
            <div className="ml-3.5 flex flex-col gap-0.5 pl-1.5">
              <OverlayNavItem
                active={keysView === 'tools'}
                icon={Wrench}
                label={t.settings.nav.keysTools}
                nested
                onClick={() => {
                  openKeysView('tools')
                  setNavSheetOpen(false)
                }}
              />
              <OverlayNavItem
                active={keysView === 'settings'}
                icon={Settings2}
                label={t.settings.nav.keysSettings}
                nested
                onClick={() => {
                  openKeysView('settings')
                  setNavSheetOpen(false)
                }}
              />
            </div>
          )}
        </>
      )}
      {isAdmin && navItem('mcp', t.settings.nav.mcp, Wrench)}
      {isAdmin && navItem('toolsets', t.settings.nav.toolsets ?? 'Tool Backends', Wrench)}
      <div className="my-2 h-px bg-border/30" />
      {isAdmin && (
        <>
          {navItem('users', 'Users', Users)}
          {navItem('grants', 'Grants', ShieldCheck)}
        </>
      )}
      {navItem('sessions', t.settings.nav.archivedChats, Archive)}
      <div className="my-2 h-px bg-border/30" />
      {navItem('about', t.settings.nav.about, Info)}
      <div className="mb-1 mt-2 h-px bg-border/30" />
      {!isMobile && (
        <>
          <button
            className="flex h-7 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-transparent px-2 text-left text-[length:var(--conversation-text-font-size)] font-normal text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Sign out</span>
          </button>
          <div className="mt-auto flex items-center gap-1 pt-2">
            <Tip label={t.settings.exportConfig}>
              <OverlayIconButton onClick={() => void exportConfig()}>
                <IconDownload className="size-3.5" />
              </OverlayIconButton>
            </Tip>
            <Tip label={t.settings.importConfig}>
              <OverlayIconButton
                onClick={() => {
                  triggerHaptic('open')
                  importInputRef.current?.click()
                }}
              >
                <IconUpload className="size-3.5" />
              </OverlayIconButton>
            </Tip>
            <Tip label={t.settings.resetToDefaults}>
              <OverlayIconButton
                className="hover:text-destructive"
                onClick={() => {
                  triggerHaptic('warning')
                  void resetConfig()
                }}
              >
                <IconRefresh className="size-3.5" />
              </OverlayIconButton>
            </Tip>
          </div>
        </>
      )}
    </>
  )

  // ── Render: Desktop vs Mobile ────────────────────────────────────────

  return (
    <OverlayView closeLabel={t.settings.closeSettings} onClose={onClose}>
      {isMobile ? (
        /* ── Mobile layout ────────────────────────────────────────────── */
        <div className="flex h-full flex-col overflow-hidden">
          {/* Sticky nav strip: back arrow + tappable section name */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border/50 px-1 py-1">
            <button
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onClose}
              type="button"
              aria-label={t.settings.closeSettings}
            >
              <Codicon name="chevron-left" size="1.125rem" />
            </button>

            <div className="flex-1" />

            <Sheet open={navSheetOpen} onOpenChange={setNavSheetOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  type="button"
                >
                  <span className="max-w-[160px] truncate">{activeLabel()}</span>
                  <Codicon name="chevron-down" size="0.875rem" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto px-2 pb-2" showCloseButton={false}>
                <div className="mx-auto mb-2 mt-1.5 h-1 w-10 shrink-0 rounded-full bg-muted" />
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <div className="flex-1" />
          </div>

          {/* Scrollable settings content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsContent />
          </div>
        </div>
      ) : (
        /* ── Desktop layout ───────────────────────────────────────────── */
        <OverlaySplitLayout>
          <OverlaySidebar>{sidebarContent}</OverlaySidebar>
          <OverlayMain className="px-0 pb-0 pt-[calc(var(--titlebar-height)+1rem)]">
            <SettingsContent />
          </OverlayMain>
        </OverlaySplitLayout>
      )}
    </OverlayView>
  )

  // ── Internal helpers ─────────────────────────────────────────────────

  async function exportConfig() {
    try {
      const cfg = await getAnakotConfigRecord()
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'anakot-config.json'
      a.click()
      URL.revokeObjectURL(url)
      triggerHaptic('success')
    } catch (err) {
      notifyError(err, t.settings.exportFailed)
    }
  }

  async function resetConfig() {
    if (!window.confirm(t.settings.resetConfirm)) return
    try {
      await saveAnakotConfig(await getAnakotConfigDefaults())
      triggerHaptic('success')
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, t.settings.resetFailed)
    }
  }

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to sign out?')) return
    triggerHaptic('warning')
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Ignore — the redirect response may cause a fetch error
    }
    window.location.href = '/'
  }

  function SettingsContent() {
    if (activeView === 'config:appearance') return <AppearanceSettings />
    if (activeView === 'about') return <AboutSettings />
    if (activeView === 'gateway') return <GatewaySettings />
    if (activeView.startsWith('config:')) {
      return (
        <ConfigSettings
          activeSectionId={activeView.slice('config:'.length)}
          gateway={gateway}
          importInputRef={importInputRef}
          onConfigSaved={onConfigSaved}
          onMainModelChanged={onMainModelChanged}
        />
      )
    }
    if (activeView === 'providers') return <ProvidersSettings onViewChange={setProviderView} view={providerView} />
    if (isAdmin && activeView === 'keys') return <KeysSettings view={keysView} />
    if (isAdmin && activeView === 'toolsets') return <ToolsetsSettings />
    if (isAdmin && activeView === 'mcp') return <McpSettings gateway={gateway} onConfigSaved={onConfigSaved} />
    if (isAdmin && activeView === 'users') return <UsersSettings />
    if (isAdmin && activeView === 'grants') return <GrantsSettings />
    return <SessionsSettings />
  }
}

export { SettingsView as SettingsPage }
