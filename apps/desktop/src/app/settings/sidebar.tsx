import { OverlayNavItem, OverlaySidebar } from '@/app/overlays/overlay-split-layout'
import { SectionHeading } from '@/app/settings/primitives'
import { useI18n } from '@/i18n'
import { Bell, Discord, Globe, Info, KeyRound, PawPrint, Settings2, Sparkles, Wrench, Zap } from '@/lib/icons'
import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { SECTIONS } from './constants'
import type { SettingsView } from './types'

// Build SETTINGS_VIEWS from SECTIONS + standalone views
const SETTINGS_VIEWS: readonly SettingsView[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsView),
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

interface SettingsSidebarProps {
  sidebarOpen?: boolean
}

/**
 * Organized settings sidebar with grouped navigation.
 * Groups: Sessions, Tools, Config.
 */
export function SettingsSidebar({ sidebarOpen = true }: SettingsSidebarProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, 'config:model' as SettingsView)

  if (!sidebarOpen) return null

  return (
    <OverlaySidebar>
      <SectionHeading icon={Settings2} title="Settings" />
      
      {/* Sessions Group */}
      <div className="mb-4">
        <div className="px-2 mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sessions</div>
        <div className="space-y-0.5">
          <OverlayNavItem
            active={activeView === 'sessions'}
            icon={Sparkles}
            label={t.settings.sections.sessions ?? 'Sessions'}
            onClick={() => setActiveView('sessions')}
          />
        </div>
      </div>
      
      {/* Tools Group */}
      <div className="mb-4">
        <div className="px-2 mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tools</div>
        <div className="space-y-0.5">
          <OverlayNavItem
            active={activeView === 'mcp'}
            icon={Wrench}
            label={t.settings.sections.mcp ?? 'MCP'}
            onClick={() => setActiveView('mcp')}
          />
          <OverlayNavItem
            active={activeView === 'toolsets'}
            icon={Wrench}
            label={t.settings.sections.toolsets ?? 'Toolsets'}
            onClick={() => setActiveView('toolsets')}
          />
          <OverlayNavItem
            active={activeView === 'browserProfile'}
            icon={Globe}
            label={t.settings.nav.browserProfile ?? 'Browser Profile'}
            onClick={() => setActiveView('browserProfile')}
          />
          <OverlayNavItem
            active={activeView === 'pets'}
            icon={PawPrint}
            label={t.settings.nav.pets ?? 'Pets'}
            onClick={() => setActiveView('pets')}
          />
        </div>
      </div>
      
      {/* Config Group */}
      <div className="mb-4">
        <div className="px-2 mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Config</div>
        <div className="space-y-0.5">
          {SECTIONS.map(section => (
            <OverlayNavItem
              key={section.id}
              active={activeView === `config:${section.id}`}
              icon={section.icon}
              label={t.settings.sections?.[section.id] ?? section.label}
              onClick={() => setActiveView(`config:${section.id}` as SettingsView)}
            />
          ))}
          <OverlayNavItem
            active={activeView === 'providers'}
            icon={Zap}
            label={t.settings.nav.providers ?? 'Providers'}
            onClick={() => setActiveView('providers')}
          />
          <OverlayNavItem
            active={activeView === 'gateway'}
            icon={Globe}
            label={t.settings.sections.gateway ?? 'Gateway'}
            onClick={() => setActiveView('gateway')}
          />
          <OverlayNavItem
            active={activeView === 'keys'}
            icon={KeyRound}
            label={t.settings.nav.keys ?? 'Keys'}
            onClick={() => setActiveView('keys')}
          />
          <OverlayNavItem
            active={activeView === 'freeModels'}
            icon={Sparkles}
            label={t.settings.nav.freeModels ?? 'Free Models'}
            nested
            onClick={() => setActiveView('freeModels')}
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
        </div>
      </div>
    </OverlaySidebar>
  )
}
