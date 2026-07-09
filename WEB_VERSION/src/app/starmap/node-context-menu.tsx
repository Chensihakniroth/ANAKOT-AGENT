import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteLearningNode, editLearningNode, loadStarmapGraph } from '@/store/starmap'
import { notify } from '@/store/notifications'

export interface NodeMenuTarget {
  id: string
  kind: 'memory' | 'skill'
  label: string
  x: number
  y: number
}

interface NodeContextMenuProps {
  onClose: () => void
  onNodeRemoved: () => void
  target: NodeMenuTarget | null
}

interface EditState {
  content: string
  id: string
  label: string
}

/** Right-click actions for a star-map node: edit (modal) or delete (confirm). */
export function NodeContextMenu({ onClose, onNodeRemoved, target }: NodeContextMenuProps) {
  const [editing, setEditing] = useState<EditState | null>(null)
  const [deleting, setDeleting] = useState<Omit<NodeMenuTarget, 'x' | 'y'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  if (!target) {
    return null
  }

  const handleEdit = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await editLearningNode(target.id, target.label)

      if (!res.ok) {
        setError(res.error ?? 'Failed to edit node')
      } else {
        setEditing(null)
        onNodeRemoved()
      }
    } catch (err) {
      setError(String(err))
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleting) return

    setSaving(true)

    try {
      const res = await deleteLearningNode(deleting.id)

      if (!res.ok) {
        notify({ message: res.error ?? 'Failed to delete node', kind: 'error' })
      } else {
        setDeleting(null)
        onNodeRemoved()
        void loadStarmapGraph()
      }
    } catch (err) {
      notify({ message: String(err), kind: 'error' })
    }

    setSaving(false)
  }

  return (
    <>
      {/* Right-click context menu */}
      {!editing && !deleting && (
        <div
          className="fixed z-50 w-44 rounded-lg border bg-[var(--color-surface)] p-1 shadow-lg"
          style={{ left: target.x, top: target.y }}
          onContextMenu={e => e.preventDefault()}
        >
          {error && (
            <div className="px-2 py-1 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-hover)]"
            onClick={() => {
              setEditing({ content: target.label, id: target.id, label: target.label })
              setError(null)
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-400 hover:bg-[var(--color-surface-hover)]"
            onClick={() => {
              setDeleting({ id: target.id, kind: target.kind, label: target.label })
              setError(null)
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onOpenChange={() => { setEditing(null); onClose() }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit {target.kind}</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <textarea
                className="w-full resize-none rounded-md border bg-[var(--color-surface)] p-2 text-sm outline-none"
                rows={4}
                value={editing.content}
                onChange={e => setEditing(prev => (prev ? { ...prev, content: e.target.value } : prev))}
              />
              {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setEditing(null); onClose() }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={handleEdit}
              >
                {loading ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <ConfirmDialog
          confirmLabel="Delete"
          description={`Are you sure you want to delete "${deleting.label}"? This action cannot be undone.`}
          destructive
          onClose={() => { setDeleting(null); onClose() }}
          onConfirm={handleDelete}
          open
          title={`Delete ${deleting.kind}`}
        />
      )}
    </>
  )
}
