// Reasoning block rendering — parse and structure thinking/reasoning content
// from model output for collapsible display.

export interface ReasoningBlock {
  content: string
  collapsed: boolean
}

/**
 * Extract reasoning blocks from a text segment.
 * Models often wrap thinking in <think>...</think> or similar delimiters.
 */
export function extractReasoningBlocks(text: string): { segments: Array<{ type: 'text' | 'reasoning'; content: string }> } {
  const segments: Array<{ type: 'text' | 'reasoning'; content: string }> = []

  // Match <think>...</think> blocks
  const reasoningRegex = /<think>([\s\S]*?)<\/think>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = reasoningRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'reasoning', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return { segments }
}

/** Strip reasoning blocks, leaving only visible content. */
export function stripReasoningBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}
