import { atom, computed } from 'nanostores'

export interface GitStatusEntry {
  path: string
  status: string
  staged: boolean
  unstaged: boolean
}

export interface GitStatus {
  root: string | null
  branch: string
  files: GitStatusEntry[]
  error?: string
}

export interface CommitSuggestion {
  type: 'feat' | 'fix' | 'chore' | 'refactor' | 'docs' | 'test' | 'style'
  scope?: string
  message: string
  body?: string
}

export interface GitCommitState {
  repoPath: string
  branch: string
  files: GitStatusEntry[]
  diff: string
  suggestions: CommitSuggestion[]
  loading: boolean
  generating: boolean
  committing: boolean
  message: string
  error?: string
  commitResult?: string
}

const initialState: GitCommitState = {
  repoPath: '',
  branch: '',
  files: [],
  diff: '',
  suggestions: [],
  loading: false,
  generating: false,
  committing: false,
  message: '',
}

export const $gitCommitState = atom<GitCommitState>(initialState)

/** Returns non-null state when there's an active git panel session. */
export const $gitCommitData = computed($gitCommitState, state =>
  state.repoPath ? state : null
)

export function setGitRepoPath(path: string) {
  $gitCommitState.set({ ...initialState, repoPath: path })
}

export function setGitLoading() {
  const prev = $gitCommitState.get()
  $gitCommitState.set({ ...prev, loading: true, error: undefined })
}

export function setGitStatus(status: GitStatus) {
  $gitCommitState.set({
    ...$gitCommitState.get(),
    loading: false,
    branch: status.branch,
    files: status.files ?? [],
    error: status.error,
  })
}

export function setGitDiff(diff: string) {
  $gitCommitState.set({ ...$gitCommitState.get(), diff })
}

export function setGitGenerating(generating: boolean) {
  $gitCommitState.set({ ...$gitCommitState.get(), generating })
}

export function setGitSuggestions(suggestions: CommitSuggestion[]) {
  $gitCommitState.set({ ...$gitCommitState.get(), generating: false, suggestions })
}

export function setGitError(error: string) {
  $gitCommitState.set({ ...$gitCommitState.get(), loading: false, generating: false, committing: false, error })
}

export function setGitCommitting(committing: boolean) {
  $gitCommitState.set({ ...$gitCommitState.get(), committing })
}

export function setGitCommitResult(result: string) {
  $gitCommitState.set({ ...$gitCommitState.get(), committing: false, commitResult: result })
}

export function setGitMessage(message: string) {
  $gitCommitState.set({ ...$gitCommitState.get(), message })
}

export function clearGitCommit() {
  $gitCommitState.set(initialState)
}
export const clearGitCommitData = clearGitCommit

/** Generate an AI prompt to produce commit suggestions from a diff. */
export function buildCommitPrompt(diff: string, files: GitStatusEntry[]): string {
  const fileList = files.map(f => `[${f.status}] ${f.path}`).join('\n')
  return `Generate 3-5 conventional commit messages for this git diff.

Files changed:
${fileList}

Diff:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Return a JSON array of objects. Each object has:
- "type": one of "feat", "fix", "chore", "refactor", "docs", "test", "style"
- "scope" (optional): the module/area
- "message": the commit message subject
- "body": optional detailed description`
}
