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

// ─── Chat-message scanner ──────────────────────────────────────────────────
// The AI code-review snippet instructs the model to include a JSON block
// between special markers at the end of its response.  This function scans
// new assistant messages, extracts the block, validates it, and populates
// the review store so the right-rail CodeReviewPanel renders it.

/** Unique markers the AI wraps structured review data in. */
export const CODE_REVIEW_DATA_MARKER = '<!-- CODE_REVIEW_DATA -->'

/** Regex that matches the JSON block between markers (greedy, multiline). */
const CODE_REVIEW_RE =
  /<!-- CODE_REVIEW_DATA -->\s*```json\s*([\s\S]*?)```\s*<!-- \/CODE_REVIEW_DATA -->/

/** Valid severity values for validation. */
const VALID_SEVERITIES: ReadonlySet<string> = new Set(['error', 'warning', 'info'])

/** Valid category values for validation. */
const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'bug', 'style', 'security', 'performance', 'suggestion',
])

/**
 * Validate and normalise a single review item.
 * Returns null if the item is structurally invalid.
 */
function validateItem(raw: unknown): ReviewItem | null {
  if (!raw || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>

  const severity = typeof obj.severity === 'string' ? obj.severity.toLowerCase() : ''
  const category = typeof obj.category === 'string' ? obj.category.toLowerCase() : ''
  const line = typeof obj.line === 'number' ? obj.line : Number(obj.line)
  const message = typeof obj.message === 'string' ? obj.message : ''

  if (!VALID_SEVERITIES.has(severity)) return null
  if (!VALID_CATEGORIES.has(category)) return null
  if (!Number.isFinite(line) || line < 1) return null
  if (!message.trim()) return null

  const suggestion =
    typeof obj.suggestion === 'string' && obj.suggestion.trim()
      ? obj.suggestion.trim()
      : undefined

  return {
    severity: severity as ReviewSeverity,
    category: category as ReviewCategory,
    line: Math.floor(line),
    message: message.trim(),
    suggestion,
  }
}

/**
 * Validate the parsed JSON payload into a CodeReviewResult.
 * Returns null if the structure is invalid.
 */
function validatePayload(raw: unknown): CodeReviewResult | null {
  if (!raw || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>

  const file = typeof obj.file === 'string' ? obj.file.trim() : ''
  const content = typeof obj.content === 'string' ? obj.content : ''
  const language = typeof obj.language === 'string' ? obj.language : undefined

  if (!file) return null

  const rawItems = Array.isArray(obj.items) ? obj.items : []
  const items: ReviewItem[] = []

  for (const rawItem of rawItems) {
    const item = validateItem(rawItem)
    if (item) items.push(item)
  }

  if (items.length === 0) return null

  return { file, content, language, items }
}

// Track message IDs we've already scanned to avoid re-processing.
let _lastScannedId = ''

/**
 * Scan the latest assistant messages for a code-review data block.
 * Call this from a useEffect that watches the messages atom.
 *
 * @param messages - current message list from $messages.get()
 * @returns true if new review data was found and populated
 */
export function scanForCodeReview(
  messages: Array<{ id: string; role: string; parts: unknown[] }>,
): boolean {
  // Only scan assistant messages, newest first.
  const assistantMsgs = messages.filter(m => m.role === 'assistant')

  for (const msg of assistantMsgs) {
    // Skip messages we've already processed.
    if (msg.id === _lastScannedId) break

    // Extract all text parts and concatenate.
    const text = (msg.parts || [])
      .filter((p: unknown): p is { type: string; text: string } =>
        typeof p === 'object' && p !== null && 'text' in p && typeof (p as Record<string, unknown>).text === 'string',
      )
      .map(p => p.text)
      .join('')

    const match = CODE_REVIEW_RE.exec(text)
    if (!match) continue

    // Found a marker block — try to parse the JSON.
    _lastScannedId = msg.id

    try {
      const parsed = JSON.parse(match[1])
      const result = validatePayload(parsed)

      if (result) {
        setReviewResult(result)
        return true
      }
    } catch {
      // JSON parse failure — skip silently.
    }

    // Marker found but invalid payload — stop scanning.
    return false
  }

  return false
}

/**
 * Reset the scanner's "last seen" pointer so the next scan re-checks
 * messages (e.g. after switching sessions).
 */
export function resetScanner() {
  _lastScannedId = ''
}
