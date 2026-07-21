import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  ARTIFACTS_ROUTE,
  MESSAGING_ROUTE,
  PLUGINS_ROUTE,
  PROFILES_ROUTE,
  SETTINGS_ROUTE,
  SKILLS_ROUTE,
  STARMAP_ROUTE,
} from '@/app/routes'
import { Codicon } from '@/components/ui/codicon'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { triggerHaptic } from '@/lib/haptics'

interface TabItem {
  icon: string
  id: string
  label: string
  route?: string
}

/** Tabs shown directly on the bottom bar (max 5 for ergonomics). */
const PRIMARY_TABS: TabItem[] = [
  { id: 'chat', icon: 'comment-discussion', label: 'Chat' },
  { id: 'skills', icon: 'symbol-misc', label: 'Tools', route: SKILLS_ROUTE },
  { id: 'starmap', icon: 'star', label: 'Starmap', route: STARMAP_ROUTE },
  { id: 'more', icon: 'ellipsis', label: 'More' },
  { id: 'settings', icon: 'settings-gear', label: 'Settings', route: SETTINGS_ROUTE },
]

/** Secondary views shown inside the "More" overflow sheet. */
const OVERFLOW_TABS: TabItem[] = [
  { id: 'messaging', icon: 'comment', label: 'Messaging', route: MESSAGING_ROUTE },
  { id: 'artifacts', icon: 'files', label: 'Artifacts', route: ARTIFACTS_ROUTE },
  { id: 'profiles', icon: 'person', label: 'Profiles', route: PROFILES_ROUTE },
  { id: 'plugins', icon: 'plug', label: 'Plugins', route: PLUGINS_ROUTE },
]

interface MobileBottomTabBarProps {
  /** Called when the Chat tab is tapped — opens the mobile sidebar sheet. */
  onOpenSidebar?: () => void
}

export function MobileBottomTabBar({ onOpenSidebar }: MobileBottomTabBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  /** Determine which route (if any) is active based on pathname. */
  const activeId = ((): string => {
    const path = location.pathname
    if (path === SETTINGS_ROUTE) return 'settings'
    if (path === SKILLS_ROUTE) return 'skills'
    if (path === STARMAP_ROUTE) return 'starmap'
    if (path === MESSAGING_ROUTE) return 'messaging'
    if (path === ARTIFACTS_ROUTE) return 'artifacts'
    if (path === PROFILES_ROUTE) return 'profiles'
    if (path === PLUGINS_ROUTE) return 'plugins'
    return 'chat'
  })()

  const handleTab = (tab: TabItem) => {
    triggerHaptic('crisp')

    if (tab.id === 'chat') {
      onOpenSidebar?.()
      return
    }

    if (tab.id === 'more') {
      setMoreOpen(true)
      return
    }

    if (tab.route) {
      navigate(tab.route)
    }
  }

  const handleOverflowTab = (tab: TabItem) => {
    triggerHaptic('crisp')

    if (tab.route) {
      setMoreOpen(false)
      navigate(tab.route)
    }
  }

  return (
    <>
      <nav className="mobile-bottom-tab-bar">
        {PRIMARY_TABS.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`mobile-bottom-tab ${isActive ? 'mobile-bottom-tab--active' : ''}`}
              onClick={() => handleTab(tab)}
              type="button"
            >
              <div className="mobile-bottom-tab__icon">
                <Codicon name={tab.icon} size="1.25rem" />
              </div>
              <span className="mobile-bottom-tab__label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* "More" overflow sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="flex flex-col gap-1 p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
          showCloseButton={false}
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
          <span className="mb-1 px-1 text-xs font-medium text-muted-foreground">More</span>
          {OVERFLOW_TABS.map((tab) => {
            const isActive = tab.id === activeId
            return (
              <button
                key={tab.id}
                aria-label={tab.label}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50'
                }`}
                onClick={() => handleOverflowTab(tab)}
                type="button"
              >
                <Codicon name={tab.icon} size="1.15rem" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </SheetContent>
      </Sheet>
    </>
  )
}
