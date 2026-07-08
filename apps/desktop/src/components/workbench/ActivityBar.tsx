import { useStore } from '@nanostores/react'
import { triggerHaptic } from '@/lib/haptics'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { $sidebarPanel, setSidebarPanel, toggleSidebar, type SidebarPanelId } from '@/store/workbench'
import { $sidebarOpen } from '@/store/layout'
import { $gitStatus } from '@/store/git'
import { SKILLS_ROUTE, MESSAGING_ROUTE, ARTIFACTS_ROUTE, SETTINGS_ROUTE, PROFILES_ROUTE, PLUGINS_ROUTE } from '../../app/routes'

interface ActivityBarItem {
  id: string
  icon: string
  label: string
  panel?: SidebarPanelId
  route?: string
}

const SIDEBAR_TOGGLE_ITEMS: ActivityBarItem[] = [
  { id: 'explorer', icon: 'files', label: 'Explorer', panel: 'explorer' },
  { id: 'chat', icon: 'comment-discussion', label: 'All Sessions', panel: 'chat' },
]

const GLOBAL_VIEW_ITEMS: ActivityBarItem[] = [
  { id: 'git', icon: 'source-control', label: 'Source Control', panel: 'git' },
  { id: 'skills', icon: 'symbol-misc', label: 'Skills & Tools', route: SKILLS_ROUTE },
  { id: 'messaging', icon: 'comment', label: 'Messaging', route: MESSAGING_ROUTE },
  { id: 'artifacts', icon: 'files', label: 'Artifacts', route: ARTIFACTS_ROUTE },
  { id: 'profiles', icon: 'person', label: 'Profiles', route: PROFILES_ROUTE },
  { id: 'plugins', icon: 'plug', label: 'Plugins', route: PLUGINS_ROUTE },
]

export function ActivityBar() {
  const navigate = useNavigate()
  const activePanel = useStore($sidebarPanel)
  const sidebarOpen = useStore($sidebarOpen)
  const gitStatus = useStore($gitStatus)

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

  const renderItem = (item: ActivityBarItem) => {
    const isActive = item.panel === activePanel && sidebarOpen
    const isGit = item.id === 'git'
    const badgeCount = isGit ? gitStatus.files.length : 0

    return (
      <button
        key={item.id}
        aria-label={item.label}
        aria-pressed={isActive}
        className={cn(
          'group relative flex h-10 w-10 items-center justify-center transition-colors focus:outline-none',
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
        <div className="relative flex items-center justify-center h-full w-full">
          <Codicon name={item.icon} size="1.25rem" />
          {badgeCount > 0 && (
            <div className="absolute right-0 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground pointer-events-none">
              {badgeCount > 99 ? '99+' : badgeCount}
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center bg-(--ui-activity-bar-background) text-(--ui-text-tertiary)">
      <div className="flex flex-1 flex-col items-center gap-0.5 pt-1">
        {SIDEBAR_TOGGLE_ITEMS.map(renderItem)}
        <div className="my-1 h-px w-6 bg-(--ui-stroke-tertiary)" />
        {GLOBAL_VIEW_ITEMS.map(renderItem)}
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
