// Transcript directives — parse `[directive:...]` annotations embedded in
// transcript content. Used by contrib surfaces and command centers.

export interface TranscriptDirective {
  type: string
  args: string
  raw: string
}

const DIRECTIVE_REGEX = /\[directive:(\w+)(?::([^\]]*))?\]/g

export function parseTranscriptDirectives(text: string): TranscriptDirective[] {
  const directives: TranscriptDirective[] = []
  let match: RegExpExecArray | null

  while ((match = DIRECTIVE_REGEX.exec(text)) !== null) {
    directives.push({
      type: match[1],
      args: match[2] ?? '',
      raw: match[0],
    })
  }

  return directives
}

/** Remove all directive annotations from text, leaving clean content. */
export function stripTranscriptDirectives(text: string): string {
  return text.replace(DIRECTIVE_REGEX, '').replace(/\s+/g, ' ').trim()
}

/** Check if a specific directive type exists in text. */
export function hasTranscriptDirective(text: string, type: string): boolean {
  return parseTranscriptDirectives(text).some(d => d.type === type)
}
