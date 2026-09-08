import { Codicon } from '@/components/ui/codicon'

export type MobileNavTab = 'chat' | 'sessions' | 'more'

interface BottomNavProps {
  activeTab: MobileNavTab
  onChatClick: () => void
  onSessionsClick: () => void
  onMoreClick: () => void
}

const TABS = [
  { id: 'chat', label: 'Chat', icon: 'comment' },
  { id: 'sessions', label: 'Sessions', icon: 'list-tree' },
  { id: 'more', label: 'More', icon: 'menu' }
] as const satisfies ReadonlyArray<{ id: MobileNavTab; label: string; icon: string }>

const HANDLER_KEYS: Record<MobileNavTab, 'onChatClick' | 'onSessionsClick' | 'onMoreClick'> = {
  chat: 'onChatClick',
  sessions: 'onSessionsClick',
  more: 'onMoreClick'
}

export function BottomNav({ activeTab, onChatClick, onSessionsClick, onMoreClick }: BottomNavProps) {
  const handlers = { onChatClick, onSessionsClick, onMoreClick }

  return (
    <nav className="flex h-16 shrink-0 items-stretch border-t border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background) px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_2px_rgba(0,0,0,0.04)]">
      {TABS.map(tab => {
        const active = activeTab === tab.id

        return (
          <button
            aria-current={active}
            aria-label={tab.label}
            className={[
              'mx-1 my-1.5 flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 transition-colors',
              active
                ? 'bg-(--ui-control-hover-background) text-(--ui-accent)'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
            ].join(' ')}
            key={tab.id}
            onClick={handlers[HANDLER_KEYS[tab.id]]}
            type="button"
          >
            <Codicon name={tab.icon} size="1.375rem" />
            <span className="text-xs font-medium leading-none">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
