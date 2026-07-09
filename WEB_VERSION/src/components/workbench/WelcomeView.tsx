import { useStore } from '@nanostores/react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ShaderBackground } from '@/components/ui/shader-background'
import { $sessions } from '@/store/session'
import { useNavigate } from 'react-router-dom'
import { NEW_CHAT_ROUTE, sessionRoute } from '@/app/routes'

interface WelcomeViewProps {
  onNewSession?: () => void
  onOpenFolder?: () => void
}

export function WelcomeView({ onNewSession, onOpenFolder }: WelcomeViewProps) {
  const sessions = useStore($sessions)
  const navigate = useNavigate()
  const recentSessions = sessions.slice(0, 5)

  const handleNewSession = () => {
    if (onNewSession) {
      onNewSession()
    } else {
      navigate(NEW_CHAT_ROUTE)
    }
  }

  const handleOpenFolder = () => {
    if (onOpenFolder) {
      onOpenFolder()
    }
  }

  return (
    <div className="relative flex h-full w-full flex-1 flex-col items-center justify-center overflow-hidden">
      {/* Shader background layer */}
      <div className="absolute inset-0 z-[5]">
        <ShaderBackground />
      </div>

      {/* Content layer sits above the shader */}
      <div className="relative z-[6] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <BrandMark className="size-12" />
        <div>
          <h1 className="font-['StarAvenue'] text-3xl font-bold uppercase tracking-[0.08em] text-foreground drop-shadow-sm">
            ANAKOT AGENT
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Start a new session or open a workspace to begin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleNewSession}>
            <Codicon name="plus" size="0.75rem" />
            New Session
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenFolder}>
            <Codicon name="folder-opened" size="0.75rem" />
            Open Folder
          </Button>
        </div>
      </div>
    </div>
  )
}
