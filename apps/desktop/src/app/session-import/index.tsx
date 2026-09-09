import { useStore } from '@nanostores/react'
import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, FileText, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $sessionImportOpen, setSessionImportOpen } from '@/store/session-import'
import { setActiveSessionId } from '@/store/session'

import {
  listForeignSessions,
  previewForeignSession,
  importForeignSession,
  type ForeignSessionItem,
  type ForeignSessionPreview,
} from './api'

export function SessionImportDialog() {
  const open = useStore($sessionImportOpen)
  const { requestGateway } = useGatewayRequest()

  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<ForeignSessionItem[]>([])
  const [filterText, setFilterText] = useState('')
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null)
  const [preview, setPreview] = useState<ForeignSessionPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [customPath, setCustomPath] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await listForeignSessions(requestGateway)
      setSessions(items)
      if (items.length > 0 && !selectedHandle) {
        setSelectedHandle(items[0].handle)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover foreign sessions')
    } finally {
      setLoading(false)
    }
  }, [requestGateway, selectedHandle])

  useEffect(() => {
    if (open) {
      void loadSessions()
    } else {
      setSelectedHandle(null)
      setPreview(null)
      setError(null)
    }
  }, [open, loadSessions])

  useEffect(() => {
    if (!selectedHandle) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    previewForeignSession(requestGateway, selectedHandle)
      .then((data) => {
        if (!cancelled) {
          setPreview(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedHandle, requestGateway])

  const handleImport = async (target: string) => {
    setImporting(true)
    setError(null)
    try {
      const res = await importForeignSession(requestGateway, target)
      setSessionImportOpen(false)
      setActiveSessionId(res.session_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (!filterText) return true
    const q = filterText.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.path.toLowerCase().includes(q) ||
      s.source.toLowerCase().includes(q)
    )
  })

  return (
    <Dialog open={open} onOpenChange={setSessionImportOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Download className="w-5 h-5 text-primary" />
            Import Foreign Session
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Convert and resume transcripts from Claude Code, OpenAI Codex, or local JSONL/Markdown files.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search discovered sessions or enter direct file path..."
            value={filterText || customPath}
            onChange={(e) => {
              setFilterText(e.target.value)
              setCustomPath(e.target.value)
            }}
            className="flex-1 px-3 py-1.5 text-xs rounded-md border border-(--stroke-nous) bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {customPath.trim() && !filteredSessions.some((s) => s.path === customPath.trim()) && (
            <Button
              size="sm"
              disabled={importing}
              onClick={() => void handleImport(customPath.trim())}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Import File
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-[320px] max-h-[420px] overflow-hidden">
          {/* Discovered sessions list */}
          <div className="flex flex-col border border-(--stroke-nous) rounded-lg overflow-y-auto divide-y divide-(--stroke-nous)/50 bg-background/30">
            {loading ? (
              <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Scanning for transcripts...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No foreign sessions found in standard paths.
                <br />
                Enter a direct file path above to import.
              </div>
            ) : (
              filteredSessions.map((item) => {
                const isSelected = selectedHandle === item.handle
                return (
                  <button
                    key={item.handle}
                    type="button"
                    onClick={() => setSelectedHandle(item.handle)}
                    className={cn(
                      'p-3 text-left transition-colors flex flex-col gap-1',
                      isSelected ? 'bg-accent/40 font-medium' : 'hover:bg-accent/20'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate font-medium text-foreground">{item.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                        {item.source}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{item.message_count} messages</span>
                      <span>•</span>
                      <span className="truncate">{item.path.split(/[/\\]/).pop()}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Preview panel */}
          <div className="flex flex-col border border-(--stroke-nous) rounded-lg overflow-hidden bg-background/20">
            {previewLoading ? (
              <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading preview...
              </div>
            ) : preview ? (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-(--stroke-nous)/60 bg-muted/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold">{preview.title}</h4>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">{preview.path}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={importing}
                    onClick={() => void handleImport(preview.handle)}
                  >
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Import
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                  {preview.preview_turns.map((turn, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-2 rounded-md border text-[11px]',
                        turn.role === 'user'
                          ? 'bg-primary/10 border-primary/20 mr-4'
                          : 'bg-muted/40 border-(--stroke-nous)/40 ml-4'
                      )}
                    >
                      <span className="font-semibold uppercase text-[10px] block mb-0.5 text-muted-foreground">
                        {turn.role}
                      </span>
                      <p className="whitespace-pre-wrap line-clamp-4">{turn.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-xs text-muted-foreground p-6 text-center">
                <FileText className="w-8 h-8 mb-2 opacity-30" />
                Select a session from the list to preview messages before importing.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
