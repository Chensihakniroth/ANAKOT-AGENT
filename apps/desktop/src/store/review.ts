import { atom, computed } from 'nanostores'

export type ReviewViewMode = 'tree' | 'flat'

export interface ReviewDiffLine {
  oldNum: number | null
  newNum: number | null
  type: 'added' | 'removed' | 'context'
  content: string
}

// We use a minimal file shape — just path + status + staged.
// This matches both GitFile (store/git.ts) and GitStatusEntry (store/git-commit.ts).
export interface ReviewFile {
  path: string
  status: string
  staged: boolean
}

export const $reviewSelectedPath = atom<string | null>(null)
export const $reviewDiff = atom<string>('')
export const $reviewDiffLines = atom<ReviewDiffLine[]>([])
export const $reviewViewMode = atom<ReviewViewMode>('tree')
export const $reviewLoadingDiff = atom(false)
export const $reviewDiffError = atom<string | null>(null)
export const $reviewCollapsedDirs = atom<Set<string>>(new Set())
export const $reviewChurnData = atom<Map<string, { added: number; removed: number }>>(new Map())

/** Parse a unified diff into structured line objects for rendering. */
function parseDiffLines(raw: string): ReviewDiffLine[] {
  const lines = raw.split('\n')
  const result: ReviewDiffLine[] = []
  let oldNum = 0
  let newNum = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldNum = parseInt(match[1], 10)
        newNum = parseInt(match[2], 10)
      }
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++')) continue
    if (line.startsWith('diff ')) continue
    if (line.startsWith('index ')) continue

    if (line.startsWith('-')) {
      result.push({ oldNum, newNum: null, type: 'removed', content: line.slice(1) })
      oldNum++
    } else if (line.startsWith('+')) {
      result.push({ oldNum: null, newNum, type: 'added', content: line.slice(1) })
      newNum++
    } else {
      result.push({ oldNum, newNum, type: 'context', content: line.startsWith(' ') ? line.slice(1) : line })
      oldNum++
      newNum++
    }
  }

  return result
}

let abortController: AbortController | null = null

/** Select a file and fetch its diff. Aborts any in-flight request. */
export async function selectReviewFile(path: string, cwd: string): Promise<void> {
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  abortController = new AbortController()
  const token = abortController.signal

  $reviewSelectedPath.set(path)
  $reviewDiff.set('')
  $reviewDiffLines.set([])
  $reviewLoadingDiff.set(true)
  $reviewDiffError.set(null)

  try {
    const safePath = cwd.replace(/\\/g, '/')
    const result = await window.anakotDesktop?.gitDiff?.(safePath, path)

    if (token.aborted) return

    if (result?.ok && result.diff) {
      $reviewDiff.set(result.diff)
      $reviewDiffLines.set(parseDiffLines(result.diff))
    } else {
      $reviewDiffError.set(result?.error || 'No diff available')
    }
  } catch (e) {
    if (token.aborted) return
    $reviewDiffError.set(e instanceof Error ? e.message : 'Failed to load diff')
  } finally {
    $reviewLoadingDiff.set(false)
  }
}

/** Clear the current diff selection. */
export function clearReviewSelection(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  $reviewSelectedPath.set(null)
  $reviewDiff.set('')
  $reviewDiffLines.set([])
  $reviewDiffError.set(null)
}

/** Toggle collapsed state of a directory node in the tree view. */
export function toggleReviewDir(dirPath: string): void {
  const collapsed = new Set($reviewCollapsedDirs.get())
  if (collapsed.has(dirPath)) {
    collapsed.delete(dirPath)
  } else {
    collapsed.add(dirPath)
  }
  $reviewCollapsedDirs.set(collapsed)
}

/** Set view mode (tree vs flat). */
export function setReviewViewMode(mode: ReviewViewMode): void {
  $reviewViewMode.set(mode)
}

/** Set churn data for visualization. */
export function setChurnData(data: Map<string, { added: number; removed: number }>): void {
  $reviewChurnData.set(data)
}
