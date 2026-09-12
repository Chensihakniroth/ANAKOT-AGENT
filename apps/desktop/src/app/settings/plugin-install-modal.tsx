// Plugin install modal — install plugins from URL or directory.

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'
import { cn } from '@/lib/utils'

interface PluginInstallModalProps {
  open: boolean
  onClose: () => void
  onInstall?: (sourceUrl: string) => Promise<void>
  className?: string
}

export function PluginInstallModal({ open, onClose, onInstall, className }: PluginInstallModalProps) {
  const [url, setUrl] = useState('')
  const [installing, setInstalling] = useState(false)

  if (!open) return null

  const handleInstall = async () => {
    if (!url.trim()) {
      notifyError('Please enter a plugin URL', 'Missing URL')
      return
    }
    setInstalling(true)
    try {
      await onInstall?.(url.trim())
      notify({ kind: 'success', message: 'Plugin installed successfully' })
      setUrl('')
      onClose()
    } catch (err) {
      notifyError(err instanceof Error ? err : 'Installation failed', 'Install Failed')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className,
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold">
          Install Plugin
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter a plugin URL or GitHub repository to install.
        </p>

        <Input
          type="url"
          placeholder="https://github.com/user/plugin-name"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void handleInstall()
            if (e.key === 'Escape') onClose()
          }}
          className="mb-4"
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={installing}>
            Cancel
          </Button>
          <Button onClick={() => void handleInstall()} disabled={installing || !url.trim()}>
            {installing ? 'Installing...' : 'Install'}
          </Button>
        </div>
      </div>
    </div>
  )
}
