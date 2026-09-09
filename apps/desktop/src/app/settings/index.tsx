import { IconDownload, IconRefresh, IconUpload } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'

import { getAnakotConfigDefaults, getAnakotConfigRecord, getAnakotConfigSchema, getEnvVars, saveAnakotConfig } from '@/anakot'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Archive, Bell, Discord, Globe, Info, KeyRound, Leaf, PawPrint, Settings2, Sparkles, Wrench, Zap, Palette } from '@/lib/icons'
import { notifyError } from '@/store/notifications'
import { useStore } from '@nanostores/react'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlayIconButton } from '../overlays/overlay-chrome'
import { OverlayMain, OverlayNavItem, OverlaySidebar, OverlaySplitLayout } from '../overlays/overlay-split-layout'
import { OverlayView } from '../overlays/overlay-view'

import { AboutSettings } from './about-settings'
import { AppearanceSettings } from './appearance-settings'
import { BrowserRealProfilePanel } from './browser-real-profile-panel'
import { ConfigSettings } from './config-settings'
import { SECTIONS } from './constants'
import { DiscordRpcSettings } from './discord-rpc-settings'
import { FreeModelSuiteSettings } from './free-model-suite-settings'
import { GatewaySettings } from './gateway-settings'
import { KEYS_VIEWS, KeysSettings, type KeysView } from './keys-settings'
import { McpSettings } from './mcp-settings'
import { NotificationsSettings } from './notifications-settings'
import { PetSettings } from './pet-settings'
import { PROVIDER_VIEWS, ProvidersSettings, type ProviderView } from './providers-settings'
import { SessionsSettings } from './sessions-settings'
import { TerminalSettings } from './terminal-settings'
import { ToolsetsSettings } from './toolsets-settings'
import { WebhooksSettings } from './webhooks-settings'
import type { SettingsPageProps, SettingsView as SettingsViewId } from './types'
import { SettingsSearchBar } from './settings-search-bar'
import { searchStore, setSearchQuery, setActiveSection } from './search-store'

const SETTINGS_VIEWS: readonly SettingsViewId[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsViewId),
  'providers',
  'gateway',
  'keys',
  'mcp',
  'toolsets',
  'pets',
  'browserProfile',
  'notifications',
  'discord',
  'sessions',
  'freeModels',
  'webhooks',
  'about'
]

export function SettingsView({ gateway, onClose, onConfigSaved, onMainModelChanged }: SettingsPageProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, 'config:model' as SettingsViewId)
  const [providerView, setProviderView] = useRouteEnumParam<ProviderView>('pview', PROVIDER_VIEWS, 'accounts')
  const [keysView, setKeysView] = useRouteEnumParam<KeysView>('kview', KEYS_VIEWS, 'tools')
  const store = useStore(searchStore)

  // Initialize search with all config keys and sections from schema and env vars
  useEffect(() => {
    try {
      const schema = getAnakotConfigSchema()
      const envVars = getEnvVars()
      const allKeys = Object.keys(schema)
      const allSections = ['config', 'model', 'chat', 'appearance', 'providers', 'gateway', 'keys', 'sessions', 'tools', 'webhooks', 'about', 'appearance']
      setSearchQuery('', allKeys, allSections)
    } catch (err) {
      console.error('Failed to init search config:', err)
    }
  }, [])

  const openProviderView = (view: ProviderView) => {
    setActiveView('providers')
    setProviderView(view)
  }

  const openKeysView = (view: KeysView) => {
    setActiveView('keys')
    setKeysView(view)
  }

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const exportConfig = async () => {
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

  const resetConfig = async () => {
    if (!window.confirm(t.settings.resetConfirm)) {
      return
    }

    try {
      await saveAnakotConfig(await getAnakotConfigDefaults())
      triggerHaptic('success')
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, t.settings.resetFailed)
    }
  }

  // When search query changes, auto-navigate to matching section
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    if (query && store.matchedKeys.length > 0) {
      // Navigate to first matching section
      const firstMatch = store.matchedKeys[0]
      setActiveSection(firstMatch)
      const section = SECTIONS.find(s => `config:${s.id}` === firstMatch)
      if (section) {
        setActiveView(`config:${section.id}` as SettingsViewId)
      }
    }
  }

  return (
    <OverlayView closeLabel={t.settings.closeSettings} onClose={onClose}>
      <OverlaySplitLayout>
        <OverlaySidebar>
          {/* Search Bar */}
          <div className="mb-3">
            <SettingsSearchBar
              onSearchChange={handleSearchChange}
            />
          </div>

          {/* Sections */}
          <OverlayNavItem
            active={activeView === 'config:model'}
            icon={Settings2}
            label={t.settings.sections.model ?? 'Model'}
            onClick={() => setActiveView('config:model')}
          />
          <OverlayNavItem
            active={activeView === 'config:chat'}
            icon={Sparkles}
            label={t.settings.sections.chat ?? 'Chat'}
            onClick={() => setActiveView('config:chat')}
          />
          <OverlayNavItem
            active={activeView === 'config:appearance'}
            icon={Palette}
            label={t.settings.sections.appearance ?? 'Appearance'}
            onClick={() => setActiveView('config:appearance')}
          />
          <div className="my-2 h-px bg-border/30" />
          <OverlayNavItem
            active={activeView === 'providers'}
            icon={Zap}
            label={t.settings.nav.providers}
            onClick={() => setActiveView('providers')}
          />
          {activeView === 'providers' && (
            <div className="ml-3.5 flex flex-col gap-0.5 pl-1.5">
              <OverlayNavItem
                active={providerView === 'accounts'}
                icon={Globe}
                label={t.settings.nav.providerAccounts}
                nested
                onClick={() => openProviderView('accounts')}
              />
              <OverlayNavItem
                active={providerView === 'keys'}
                icon={KeyRound}
                label={t.settings.nav.providerApiKeys}
                nested
                onClick={() => openProviderView('keys')}
              />
            </div>
          )}
          <OverlayNavItem
            active={activeView === 'gateway'}
            icon={Globe}
            label={t.settings.nav.gateway}
            onClick={() => setActiveView('gateway')}
          />
          <OverlayNavItem
            active={activeView === 'keys'}
            icon={KeyRound}
            label={t.settings.nav.apiKeys}
            onClick={() => setActiveView('keys')}
          />
          {activeView === 'keys' && (
            <div className="ml-3.5 flex flex-col gap-0.5 pl-1.5">
              <OverlayNavItem
                active={keysView === 'tools'}
                icon={Wrench}
                label={t.settings.nav.keysTools}
                nested
                onClick={() => openKeysView('tools')}
              />
              <OverlayNavItem
                active={keysView === 'settings'}
                icon={Settings2}
                label={t.settings.nav.keysSettings}
                nested
                onClick={() => openKeysView('settings')}
              />
            </div>
          )}
          <OverlayNavItem
            active={activeView === 'mcp'}
            icon={Wrench}
            label={t.settings.nav.mcp}
            onClick={() => setActiveView('mcp')}
          />
          <OverlayNavItem
            active={activeView === 'toolsets'}
            icon={Wrench}
            label={t.settings.nav.toolsets ?? 'Tool Backends'}
            onClick={() => setActiveView('toolsets')}
          />
          <OverlayNavItem
            active={activeView === 'pets'}
            icon={PawPrint}
            label={t.settings.nav.pets ?? 'Pets'}
            onClick={() => setActiveView('pets')}
          />
          <OverlayNavItem
            active={activeView === 'browserProfile'}
            icon={Globe}
            label={t.settings.nav.browserProfile ?? 'Browser Profile'}
            onClick={() => setActiveView('browserProfile')}
          />
          <OverlayNavItem
            active={activeView === 'notifications'}
            icon={Bell}
            label={t.settings.nav.notifications ?? 'Notifications'}
            onClick={() => setActiveView('notifications')}
          />
          <OverlayNavItem
            active={activeView === 'discord'}
            icon={Discord}
            label={t.settings.nav.discord ?? 'Discord'}
            nested
            onClick={() => setActiveView('discord')}
          />
          <OverlayNavItem
            active={activeView === 'webhooks'}
            icon={Globe}
            label={t.settings.nav.webhooks ?? 'Webhooks'}
            nested
            onClick={() => setActiveView('webhooks')}
          />
          <OverlayNavItem
            active={activeView === 'about'}
            icon={Info}
            label={t.settings.nav.about ?? 'About'}
            onClick={() => setActiveView('about')}
          />
        </OverlaySidebar>

        <OverlayMain className="px-0 pb-0 pt-[calc(var(--titlebar-height)+1rem)]">
          {/* Search results overview when query is active */}
          {store.query && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Search Results</h3>
              <p className="text-xs text-muted-foreground">
                Found {store.matchedKeys.length} matching setting{store.matchedKeys.length !== 1 ? 's' : ''}
              </p>
              {store.matchedKeys.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {store.matchedKeys.slice(0, 10).map(key => (
                    <li
                      key={key}
                      className="text-xs text-foreground cursor-pointer hover:text-accent-foreground"
                      onClick={() => setSearchQuery(key)}
                    >
                      {key}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeView === 'config:appearance' ? (
            <AppearanceSettings gateway={gateway} />
          ) : activeView === 'config:terminal' ? (
            <TerminalSettings />
          ) : activeView === 'about' ? (
            <AboutSettings />
          ) : activeView === 'gateway' ? (
            <GatewaySettings />
          ) : activeView.startsWith('config:') ? (
            <ConfigSettings
              activeSectionId={activeView.slice('config:'.length)}
              gateway={gateway}
              importInputRef={importInputRef}
              onConfigSaved={onConfigSaved}
              onMainModelChanged={onMainModelChanged}
            />
          ) : activeView === 'providers' ? (
            <ProvidersSettings onViewChange={setProviderView} view={providerView} />
          ) : activeView === 'keys' ? (
            <KeysSettings view={keysView} />
          ) : activeView === 'toolsets' ? (
            <ToolsetsSettings />
          ) : activeView === 'mcp' ? (
            <McpSettings gateway={gateway} onConfigSaved={onConfigSaved} />
          ) : activeView === 'pets' ? (
            <PetSettings />
          ) : activeView === 'browserProfile' ? (
            <BrowserRealProfilePanel />
          ) : activeView === 'notifications' ? (
            <NotificationsSettings />
          ) : activeView === 'discord' ? (
            <DiscordRpcSettings />
          ) : activeView === 'freeModels' ? (
            <FreeModelSuiteSettings gateway={gateway} onMainModelChanged={onMainModelChanged} />
          ) : activeView === 'webhooks' ? (
            <WebhooksSettings />
          ) : (
            <SessionsSettings />
          )}
        </OverlayMain>
      </OverlaySplitLayout>
    </OverlayView>
  )
}

export { SettingsView as SettingsPage }