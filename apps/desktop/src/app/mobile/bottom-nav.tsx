import { Codicon } from '@/components/ui/codicon'

interface BottomNavProps {
  onSessionsClick: () => void
  onSettingsClick: () => void
}

const navItemClass =
  'flex flex-col items-center gap-0.5 text-[0.6rem] min-w-0 px-3 py-1 rounded-md transition-colors'
const activeClass = 'text-(--ui-text-primary)'
const inactiveClass = 'text-(--ui-text-tertiary)'

export function BottomNav({ onSessionsClick, onSettingsClick }: BottomNavProps) {
  return (
    <nav className="flex items-center justify-around h-14 shrink-0 border-t border-(--ui-stroke-tertiary) bg-background px-2 pb-[env(safe-area-inset-bottom)]">
      {/* Chat — always active on mobile since we show chat by default */}
      <span className={`${navItemClass} ${activeClass}`}>
        <Codicon name="comment" size="1.25rem" />
        <span>Chat</span>
      </span>

      <button className={`${navItemClass} ${inactiveClass}`} onClick={onSessionsClick} type="button">
        <Codicon name="list-tree" size="1.25rem" />
        <span>Sessions</span>
      </button>

      <button className={`${navItemClass} ${inactiveClass}`} onClick={onSettingsClick} type="button">
        <Codicon name="gear" size="1.25rem" />
        <span>Settings</span>
      </button>
    </nav>
  )
}
