import { atom, computed } from 'nanostores'

export type ReviewSeverity = 'error' | 'warning' | 'info'
export type ReviewCategory = 'bug' | 'style' | 'security' | 'performance' | 'suggestion'

export interface ReviewItem {
  severity: ReviewSeverity
  category: ReviewCategory
  line: number
  message: string
  suggestion?: string
}

export interface CodeReviewState {
  file: string
  content: string
  items: ReviewItem[]
  language?: string
  error?: string
  loading: boolean
}

export interface CodeReviewResult {
  file: string
  content: string
  language?: string
  items: ReviewItem[]
}

export const $reviewState = atom<CodeReviewState>({
  file: '',
  content: '',
  items: [],
  loading: false,
})

/** Returns the full state when there's an active review, or null when idle. */
export const $codeReviewData = computed($reviewState, state =>
  state.file && state.items.length > 0 ? state : null
)

/** Set the review result from an AI response or direct invocation. */
export function setReviewResult(result: CodeReviewResult) {
  $reviewState.set({
    ...result,
    loading: false,
    error: undefined,
  })
}

/** Set loading state while a review is in progress. */
export function setReviewLoading(file: string, content: string, language?: string) {
  $reviewState.set({
    file,
    content,
    items: [],
    loading: true,
    language,
    error: undefined,
  })
}

/** Set an error state. */
export function setReviewError(error: string) {
  const prev = $reviewState.get()
  $reviewState.set({
    ...prev,
    loading: false,
    error,
  })
}

/** Clear the review state entirely. */
export function clearReview() {
  $reviewState.set({
    file: '',
    content: '',
    items: [],
    loading: false,
  })
}
export const clearCodeReviewData = clearReview

/** Summary counts for severity badges. */
export function reviewSummary(items: ReviewItem[]) {
  return {
    error: items.filter(i => i.severity === 'error').length,
    warning: items.filter(i => i.severity === 'warning').length,
    info: items.filter(i => i.severity === 'info').length,
  }
}

const VALID_SEVERITIES = new Set(['error', 'warning', 'info'])
const VALID_CATEGORIES = new Set(['bug', 'style', 'security', 'performance', 'suggestion'])

/**
 * Extract a structured CODE_REVIEW_JSON block from AI response text.
 * Looks for ```CODE_REVIEW_JSON\n{...}\n``` fence, parses + validates.
 * Returns null when no block is found or the JSON is malformed.
 */
export function parseReviewJson(text: string): CodeReviewResult | null {
  // Match ```CODE_REVIEW_JSON followed by optional whitespace, then JSON content
  const match = text.match(/```CODE_REVIEW_JSON\s*\n([\s\S]*?)\n\s*```/)
  if (!match) {
    return null
  }

  try {
    const raw = JSON.parse(match[1])
    if (!raw || typeof raw !== 'object') {
      return null
    }

    const file = typeof raw.file === 'string' ? raw.file : ''
    const language = typeof raw.language === 'string' ? raw.language : undefined
    const items: ReviewItem[] = Array.isArray(raw.items)
      ? raw.items
          .filter((item: Record<string, unknown>) => {
            return (
              item &&
              typeof item === 'object' &&
              typeof item.message === 'string' &&
              typeof item.line === 'number' &&
              VALID_SEVERITIES.has(item.severity as string) &&
              VALID_CATEGORIES.has(item.category as string)
            )
          })
          .map((item: Record<string, unknown>) => ({
            severity: item.severity as ReviewSeverity,
            category: item.category as ReviewCategory,
            line: item.line as number,
            message: item.message as string,
            suggestion: typeof item.suggestion === 'string' ? item.suggestion : undefined,
          }))
      : []

    if (!items.length) {
      return null
    }

    return { file, content: '', language, items }
  } catch {
    return null
  }
}
