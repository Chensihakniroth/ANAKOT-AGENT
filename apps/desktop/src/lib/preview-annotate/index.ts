// Preview annotations — overlay annotations on preview tiles.
// Exports index for the preview-annotate lib module.

export interface PreviewAnnotation {
  id: string
  text: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  tone: 'info' | 'warning' | 'error' | 'success'
}

export interface PreviewAnnotateTarget {
  type: string
  metadata?: Record<string, string>
}

/** Generate annotations for a preview target based on its metadata. */
export function getPreviewAnnotations(target: PreviewAnnotateTarget): PreviewAnnotation[] {
  const annotations: PreviewAnnotation[] = []

  if (target.metadata?.error) {
    annotations.push({
      id: 'error',
      text: target.metadata.error,
      position: 'top-right',
      tone: 'error',
    })
  }

  if (target.metadata?.generated) {
    annotations.push({
      id: 'generated',
      text: 'AI Generated',
      position: 'bottom-left',
      tone: 'info',
    })
  }

  return annotations
}

export function formatAnnotationText(annotation: PreviewAnnotation): string {
  return annotation.text
}
