import { useStore } from '@nanostores/react'
import { triggerHaptic } from '@/lib/haptics'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { $sidebarPanel, $sidebarOpen, setSidebarPanel, toggleSidebar, type SidebarPanelId } from '@/store/workbench'
import { SKILLS_ROUTE, MESSAGING_ROUTE, ARTIFACTS_ROUTE, SETTINGS_ROUTE, CRON_ROUTE, PROFILES_ROUTE, AGENTS_ROUTE, COMMAND_CENTER_ROUTE } from '../../app/routes'

interface ActivityBarItem {
  id: string
  icon: string
  label: string
  panel?: SidebarPanelId
  route?: string
}

const TOP_ITEMS: ActivityBarItem[] = [
  { id: 'explorer', icon: 'files', label: 'Explorer', panel: 'explorer' },
  { id: 'chat', icon: 'comment-discussion', label: 'All Sessions', panel: 'chat' },
  { id: 'skills', icon: 'symbol-misc', label: 'Skills & Tools', route: SKILLS_ROUTE },
  { id: 'messaging', icon: 'comment', label: 'Messaging', route: MESSAGING_ROUTE },
  { id: 'artifacts', icon: 'files', label: 'Artifacts', route: ARTIFACTS_ROUTE },
  { id: 'cron', icon: 'clock', label: 'Cron', route: CRON_ROUTE },
  { id: 'agents', icon: 'robot', label: 'Agents', route: AGENTS_ROUTE },
  { id: 'command-center', icon: 'terminal', label: 'Command Center', route: COMMAND_CENTER_ROUTE },
  { id: 'profiles', icon: 'person', label: 'Profiles', route: PROFILES_ROUTE },
]

export function ActivityBar() {
  const navigate = useNavigate()
  const activePanel = useStore($sidebarPanel)
  const sidebarOpen = useStore($sidebarOpen)

  const handleClick = (item: ActivityBarItem) => {
    triggerHaptic('crisp')
    if (item.route) {
      navigate(item.route)
      return
    }
    if (item.panel) {
      if (item.panel === activePanel && sidebarOpen) {
        toggleSidebar()
      } else {
        setSidebarPanel(item.panel)
        if (!sidebarOpen) toggleSidebar()
      }
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center bg-(--ui-activity-bar-background) text-(--ui-text-tertiary)">
      <div className="flex flex-1 flex-col items-center gap-0.5 pt-1">
        {TOP_ITEMS.map(item => {
          const isActive = item.panel === activePanel && sidebarOpen
          return (
            <button
              key={item.id}
              aria-label={item.label}
              aria-pressed={isActive}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center transition-colors',
                'hover:text-foreground',
                isActive && 'text-foreground'
              )}
              onClick={() => handleClick(item)}
              title={item.label}
              type="button"
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm bg-foreground" />
              )}
              <Codicon name={item.icon} size="1.25rem" />
            </button>
          )
        })}
      </div>

      {/* Bottom items */}
      <div className="mb-1 flex flex-col items-center gap-0.5">
        <button
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center transition-colors hover:text-foreground"
          onClick={() => navigate(SETTINGS_ROUTE)}
          title="Settings"
          type="button"
        >
          <Codicon name="settings-gear" size="1.25rem" />
        </button>
      </div>
    </div>
  )
}
