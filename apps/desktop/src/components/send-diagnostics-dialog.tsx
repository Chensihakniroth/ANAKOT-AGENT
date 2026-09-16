// Send Diagnostics — the consent-gated debug-bundle upload dialog.
//
// Rendered globally (desktop-controller.tsx) and driven by the $sendDiagnostics
// store: any surface opens it via requestSendDiagnostics(). Three faces:
//   consent   — privacy notice (what's collected, who can see it, retention)
//               with an explicit Upload button; nothing is sent before it.
//   uploading — spinner while the backend collects, redacts and uploads.
//   done      — the private view link (copyable) + where to pick up the
//               discussion: GitHub Issues · Discord · Docs.
import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { useI18n } from '@/i18n'
import { ExternalLink, Lock, Loader2 } from '@/lib/icons'
import { openExternalLink } from '@/lib/external-link'
import { $sendDiagnostics, confirmSendDiagnostics, dismissSendDiagnostics } from '@/store/send-diagnostics'

const SUPPORT_LINKS = [
  { key: 'github', url: 'https://github.com/Chensihakniroth/ANAKOT-AGENT/issues' },
  { key: 'discord', url: 'https://discord.gg/anakot' }
] as const

export function SendDiagnosticsHost() {
  const { t } = useI18n()
  const state = useStore($sendDiagnostics)

  if (!state) {
    return null
  }

  const busy = state.phase === 'uploading'
  // Use generic keys since sendDiagnostics i18n may not exist yet
  const title = 'Send Diagnostics'
  const privacyNotice =
    'This uploads a debug bundle to Anakot storage. It includes system info (OS, versions, provider, which API keys are configured — never the keys themselves) and full agent, gateway, and desktop logs, which likely contain conversation content, tool outputs, and file paths. Secrets are redacted before upload. The bundle is viewable only by Anakot maintainers and auto-deletes after 14 days.'

  return (
    <Dialog onOpenChange={open => (!open ? dismissSendDiagnostics() : undefined)} open>
      <DialogContent className="max-w-[30rem]">
        {state.phase === 'consent' || state.phase === 'uploading' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="size-4 text-(--ui-text-tertiary)" />
                {title}
              </DialogTitle>
              <DialogDescription className="whitespace-pre-line text-left">
                {privacyNotice}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={dismissSendDiagnostics} variant="ghost">
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void confirmSendDiagnostics()}>
                {busy ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  'Upload'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : state.phase === 'error' ? (
          <>
            <DialogHeader>
              <DialogTitle>Upload failed</DialogTitle>
              <DialogDescription className="text-left">
                {state.error}
                {'\n'}
                You can also run <code className="rounded bg-(--ui-bg-elevated) px-1 py-0.5 font-mono text-[0.6875rem]">anakot debug share</code> from a terminal.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={dismissSendDiagnostics} variant="ghost">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Diagnostics sent</DialogTitle>
              <DialogDescription className="text-left">
                Your bundle was uploaded privately. Share the link below in your support thread so the team can see your logs.
              </DialogDescription>
            </DialogHeader>
            {(state.result?.viewUrl || state.result?.uploadId) && (
              <div
                className="flex items-center gap-2 rounded-md border border-(--ui-stroke-tertiary) px-3 py-2"
                data-selectable-text="true"
              >
                {state.result.viewUrl ? (
                  <a
                    className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-(--ui-text-secondary) underline"
                    href={state.result.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={state.result.viewUrl}
                  >
                    {state.result.viewUrl}
                  </a>
                ) : (
                  <code className="min-w-0 flex-1 truncate text-[0.78rem] text-(--ui-text-secondary)">
                    No view link — quote upload ID {state.result.uploadId} to support
                  </code>
                )}
                <CopyButton
                  appearance="inline"
                  className="shrink-0"
                  label="Copy link"
                  text={state.result.viewUrl ?? state.result.uploadId ?? ''}
                />
              </div>
            )}
            <div className="text-[0.8rem] text-(--ui-text-secondary)">Pick up the discussion in:</div>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORT_LINKS.map(link => (
                <Button key={link.key} onClick={() => openExternalLink(link.url)} size="sm" variant="outline">
                  <ExternalLink className="size-3" />
                  {link.key === 'github' ? 'GitHub Issues' : 'Discord'}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={dismissSendDiagnostics} variant="ghost">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
