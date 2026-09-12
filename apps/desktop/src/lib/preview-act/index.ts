// Preview interactions — click-to-action on preview tiles.
// Exports index for the preview-act lib module.

export interface PreviewAction {
  id: string
  label: string
  icon?: string
  run: () => void | Promise<void>
}

export interface PreviewActTarget {
  url?: string
  path?: string
  content?: string
  type: 'image' | 'file' | 'link' | 'code'
}

/** Get available actions for a preview target. */
export function getPreviewActions(target: PreviewActTarget): PreviewAction[] {
  const actions: PreviewAction[] = []

  if (target.url) {
    actions.push({
      id: 'open-browser',
      label: 'Open in Browser',
      run: () => { window.open(target.url, '_blank')?.focus() },
    })
  }

  if (target.path) {
    actions.push({
      id: 'reveal',
      label: 'Reveal in Finder',
      run: () => { void window.anakotDesktop?.revealPath?.(target.path!) },
    })
  }

  if (target.content) {
    actions.push({
      id: 'copy',
      label: 'Copy',
      run: () => { void window.anakotDesktop?.writeClipboard?.(target.content!) },
    })
  }

  return actions
}
