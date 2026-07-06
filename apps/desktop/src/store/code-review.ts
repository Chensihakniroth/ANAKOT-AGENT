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
