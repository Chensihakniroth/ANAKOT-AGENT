import { useStore } from '@nanostores/react'
import { $sidebarPanel } from '@/store/workbench'

interface SidebarHostProps {
  search: React.ReactNode
  chat: React.ReactNode
}

export function SidebarHost({ search, chat }: SidebarHostProps) {
  const panel = useStore($sidebarPanel)

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-(--ui-sidebar-surface-background)">
      {panel === 'search' && search}
      {panel === 'chat' && chat}
    </div>
  )
}
