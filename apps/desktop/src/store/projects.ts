import { atom } from 'nanostores'

import {
  liveSessionProjectId,
  NO_PROJECT_ID,
  type SidebarProjectTree
} from '@/app/chat/sidebar/projects/workspace-groups'
import { translateNow } from '@/i18n'
import { desktopGit } from '@/lib/desktop-git'
import { storedString } from '@/lib/storage'
import { $gateway, activeGateway, ensureActiveGatewayOpen } from '@/store/gateway'
import { setSidebarAgentsGrouped } from '@/store/layout'
import { notify } from '@/store/notifications'
import { $freshSessionRequest } from '@/store/profile'
import {
  $currentCwd,
  $selectedStoredSessionId,
  $sessions
} from '@/store/session'
import type {
  AnakotGitBaseBranch,
  AnakotGitBranch,
  ProjectInfo,
  ProjectsPayload,
  SessionInfo
} from '@/types/anakot'

// A stored session row matches a "stored id" when the ids are equal or share a
// lineage root (a retry/sibling of the same underlying thread).
const sessionMatchesStoredId = (session: SessionInfo, id: string): boolean =>
  session.id === id || (Boolean(session._lineage_root_id) && session._lineage_root_id === id)

// First-class, per-profile Projects (named, multi-folder workspaces). State is
// served by the live gateway's `projects.*` JSON-RPC methods, which wrap the
// per-profile projects.db store. The sidebar groups sessions by project folder
// membership; these atoms are the renderer's cached view.

export const $projects = atom<ProjectInfo[]>([])
export const $activeProjectId = atom<null | string>(null)

// The authoritative project -> repo -> lane tree (overview), served by
// `projects.tree`. Lanes carry counts + structure; per-project session rows are
// fetched lazily on drill-in via `fetchProjectSessions`.
export const $projectTree = atom<SidebarProjectTree[]>([])
export const $projectTreeLoading = atom(false)

// False when the connected backend predates the projects.* JSON-RPC surface.
export const $projectsRpcAvailable = atom<boolean | null>(null)

function markProjectsRpcSuccess(): void {
  $projectsRpcAvailable.set(true)
}

function isMissingRpcMethod(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)

  return /unknown method|method not found|no such method/i.test(message)
}

function markProjectsRpcFailure(err: unknown): void {
  if (isMissingRpcMethod(err)) {
    $projectsRpcAvailable.set(false)
  }
}

function projectsStaleBackendError(): Error {
  return new Error(translateNow('sidebar.projects.staleBackend'))
}

// ── RPC plumbing ───────────────────────────────────────────────────────────
// The gateway is always connected for the desktop renderer; request through the
// active gateway so multi-profile routing (request.profile) is preserved.

async function projectsRpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const gateway = activeGateway() ?? (await ensureActiveGatewayOpen())

  if (!gateway) {
    throw new Error('Anakot gateway unavailable')
  }

  try {
    return await gateway.request<T>(method, params)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!/not connected|connection closed/i.test(message)) {
      throw error
    }

    const recovered = await ensureActiveGatewayOpen()

    if (!recovered) {
      throw error
    }

    return recovered.request<T>(method, params)
  }
}

// ── Client-side cache eviction (optimistic layer) ───────────────────────────
export const $removedSessionIds = atom<Set<string>>(new Set())

export function tombstoneSessions(ids: Array<null | string | undefined>): void {
  const next = new Set($removedSessionIds.get())
  const before = next.size

  for (const id of ids) {
    const trimmed = id?.trim()

    if (trimmed) {
      next.add(trimmed)
    }
  }

  if (next.size !== before) {
    $removedSessionIds.set(next)
  }
}

export function untombstoneSessions(ids: Array<null | string | undefined>): void {
  const current = $removedSessionIds.get()

  if (!current.size) {
    return
  }

  const next = new Set(current)

  for (const id of ids) {
    const trimmed = id?.trim()

    if (trimmed) {
      next.delete(trimmed)
    }
  }

  if (next.size !== current.size) {
    $removedSessionIds.set(next)
  }
}

export const $sessionMutationsInFlight = atom<Set<string>>(new Set())

function mutateInFlight(ids: Array<null | string | undefined>, add: boolean): void {
  const current = $sessionMutationsInFlight.get()
  const next = new Set(current)

  for (const id of ids) {
    const trimmed = id?.trim()

    if (trimmed) {
      add ? next.add(trimmed) : next.delete(trimmed)
    }
  }

  if (next.size !== current.size) {
    $sessionMutationsInFlight.set(next)
  }
}

export const beginSessionMutation = (ids: Array<null | string | undefined>): void => mutateInFlight(ids, true)
export const endSessionMutation = (ids: Array<null | string | undefined>): void => mutateInFlight(ids, false)

// True while the disk scan is in flight (drives the "finding repos" hint).
export const $reposScanning = atom(false)

// ── Project scope (the "you're inside a project" view) ─────────────────────
export const ALL_PROJECTS = '__all_projects__'

const PROJECT_SCOPE_KEY = 'anakot.desktop.projectScope'

export const $projectScope = atom<string>(storedString(PROJECT_SCOPE_KEY) || ALL_PROJECTS)

export function enterProject(id: string): void {
  $projectScope.set(id)

  if (id.startsWith('p_')) {
    void setActiveProject(id).catch(() => undefined)
  }
}

export function exitProjectScope(): void {
  $projectScope.set(ALL_PROJECTS)
}

export function persistProjectScope(): void {
  try {
    window.localStorage.setItem(PROJECT_SCOPE_KEY, $projectScope.get())
  } catch {
    // Scope is a local preference; restricted storage is fine.
  }
}

$projectScope.subscribe(persistProjectScope)

// A project's working root: its primary folder, else the first repo that has
// one. Empty for the path-less Home bucket.
const projectRootCwd = (project: SidebarProjectTree | undefined): string =>
  (project?.path || project?.repos.find(repo => repo.path)?.path || '').trim()

// ⌘K "go to project": flip the sidebar into grouped mode and enter the project
// — a pure scope switch, same as clicking the overview row.
export function goToProject(id: string, options?: { newSession?: boolean }): void {
  setSidebarAgentsGrouped(true)
  enterProject(id)

  if (!options?.newSession) {
    return
  }

  const cwd = projectRootCwd($projectTree.get().find(node => node.id === id))

  if (cwd) {
    requestStartWorkSession(cwd, undefined, { openTab: true })
  } else {
    $freshSessionRequest.set($freshSessionRequest.get() + 1)
  }
}

const underPath = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent.endsWith('/') ? parent : `${parent}/`)

// The project (explicit or auto) that owns `cwd`, by longest path match across
// the live tree. Null when no project covers it.
export function projectIdForCwd(cwd: string): null | string {
  let best: null | string = null
  let bestLen = -1

  for (const project of $projectTree.get()) {
    const paths = [project.path, ...project.repos.flatMap(repo => [repo.path, ...repo.groups.map(group => group.path)])]

    for (const path of paths) {
      const p = (path || '').trim()

      if (p && underPath(p, cwd) && p.length > bestLen) {
        bestLen = p.length
        best = project.id
      }
    }
  }

  return best
}

// ── Refresh ────────────────────────────────────────────────────────────────
interface ProjectsPayloadFull extends ProjectsPayload {
  active_id?: null | string
}

function applyPayload(payload: ProjectsPayloadFull): void {
  $projects.set(payload.projects ?? [])
  $activeProjectId.set(payload.active_id ?? null)
}

export async function refreshProjects(): Promise<void> {
  try {
    applyPayload(await projectsRpc<ProjectsPayloadFull>('projects.list'))
    markProjectsRpcSuccess()
  } catch (err) {
    markProjectsRpcFailure(err)
  }
}

interface ProjectTreePayload {
  projects: SidebarProjectTree[]
  active_id: null | string
  scoped_session_ids: string[]
}

let projectTreeRefreshGeneration = 0

async function refreshProjectTreeOn(gateway: NonNullable<ReturnType<typeof activeGateway>>): Promise<void> {
  const generation = ++projectTreeRefreshGeneration

  if (activeGateway() === gateway) {
    $projectTreeLoading.set(true)
  }

  try {
    const res = await gateway.request<ProjectTreePayload>('projects.tree', {
      preview_limit: 3
    })

    if (generation !== projectTreeRefreshGeneration || activeGateway() !== gateway) {
      return
    }

    const scoped = new Set(res.scoped_session_ids ?? [])
    $projectTree.set(res.projects ?? [])
    $activeProjectId.set(res.active_id ?? null)
    const tombstones = $removedSessionIds.get()

    if (tombstones.size) {
      const inFlight = $sessionMutationsInFlight.get()
      const pending = new Set([...tombstones].filter(id => scoped.has(id) || inFlight.has(id)))

      if (pending.size !== tombstones.size) {
        $removedSessionIds.set(pending)
      }
    }

    markProjectsRpcSuccess()
  } catch (err) {
    if (activeGateway() === gateway) {
      markProjectsRpcFailure(err)
    }
  } finally {
    if (generation === projectTreeRefreshGeneration && activeGateway() === gateway) {
      $projectTreeLoading.set(false)
    }
  }
}

export async function refreshProjectTree(): Promise<void> {
  const gateway = activeGateway()

  if (!gateway) {
    return
  }

  await refreshProjectTreeOn(gateway)
}

// Fully hydrated lanes for one project, fetched when the user enters it.
export async function fetchProjectSessions(projectId: string): Promise<SidebarProjectTree | null> {
  try {
    const res = await projectsRpc<{ project: SidebarProjectTree | null }>('projects.project_sessions', {
      project_id: projectId
    })

    return res.project ?? null
  } catch {
    return null
  }
}

export interface RepoDiscoveryPolicy {
  enabled: boolean
  roots: string[]
  exclude_paths: string[]
}

export function repoDiscoveryPolicyFromConfig(config: unknown): RepoDiscoveryPolicy {
  const desktopValue = config && typeof config === 'object' ? (config as { desktop?: unknown }).desktop : undefined

  const desktop =
    desktopValue && typeof desktopValue === 'object'
      ? (desktopValue as {
          repo_scan_enabled?: unknown
          repo_scan_exclude_paths?: unknown
          repo_scan_roots?: unknown
        })
      : {}

  return {
    enabled: desktop.repo_scan_enabled !== false,
    roots: Array.isArray(desktop.repo_scan_roots)
      ? desktop.repo_scan_roots.filter((value): value is string => typeof value === 'string')
      : [],
    exclude_paths: Array.isArray(desktop.repo_scan_exclude_paths)
      ? desktop.repo_scan_exclude_paths.filter((value): value is string => typeof value === 'string')
      : []
  }
}

export function repoDiscoveryPolicySignature(policy: RepoDiscoveryPolicy): string {
  return JSON.stringify(policy)
}

interface RepoScanState {
  completedSignature?: string
  generation: number
  runningSignature?: string
}

const repoScanStates = new WeakMap<object, RepoScanState>()
const scanningGatewayGenerations = new WeakMap<object, number>()

function syncReposScanning(): void {
  const gateway = activeGateway()
  $reposScanning.set(Boolean(gateway && scanningGatewayGenerations.has(gateway)))
}

$gateway.subscribe(syncReposScanning)

// Read the backend's `desktop` config section for repo-scan policy. Falls back
// to the shipped defaults (scan on) when the backend predates the key.
async function repoDiscoveryPolicy(): Promise<RepoDiscoveryPolicy> {
  try {
    const config = await projectsRpc<unknown>('config.get', { key: 'desktop' })

    return repoDiscoveryPolicyFromConfig(config)
  } catch {
    return repoDiscoveryPolicyFromConfig({})
  }
}

export async function scanAndRecordRepos(force = false): Promise<void> {
  const gateway = activeGateway()

  if (!gateway) {
    return
  }

  const scan = desktopGit()?.scanRepos

  if (!scan) {
    return
  }

  const state = repoScanStates.get(gateway) ?? { generation: 0 }
  repoScanStates.set(gateway, state)
  let generation: number | undefined

  try {
    const policy = await repoDiscoveryPolicy()
    const signature = repoDiscoveryPolicySignature(policy)

    if (!force && (state.completedSignature === signature || state.runningSignature === signature)) {
      return
    }

    generation = ++state.generation
    state.runningSignature = signature

    if (!policy.enabled) {
      await gateway.request('projects.record_repos', {
        discovery_policy: policy,
        repos: []
      })
    } else {
      scanningGatewayGenerations.set(gateway, generation)
      syncReposScanning()

      const repos = await scan(policy.roots, {
        enabled: true,
        excludePaths: policy.exclude_paths
      })

      if (state.generation !== generation) {
        return
      }

      await gateway.request('projects.record_repos', {
        discovery_policy: policy,
        repos
      })
    }

    if (state.generation !== generation) {
      return
    }

    state.completedSignature = signature
    await refreshProjectTreeOn(gateway)
  } catch {
    state.completedSignature = undefined
  } finally {
    state.runningSignature = undefined

    if (scanningGatewayGenerations.get(gateway) === generation) {
      scanningGatewayGenerations.delete(gateway)
    }

    syncReposScanning()
  }
}

export interface CreateProjectInput {
  name: string
  folders?: string[]
  primaryPath?: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  boardSlug?: string
  use?: boolean
  // Free-text project idea; written to IDEA.md at the primary folder on create.
  idea?: string
}

// ── Optimistic cache layer ─────────────────────────────────────────────────
interface ProjectsSnapshot {
  projects: ProjectInfo[]
  tree: SidebarProjectTree[]
  active: null | string
}

const snapshotProjects = (): ProjectsSnapshot => ({
  projects: $projects.get(),
  tree: $projectTree.get(),
  active: $activeProjectId.get()
})

const restoreProjects = ({ projects, tree, active }: ProjectsSnapshot): void => {
  $projects.set(projects)
  $projectTree.set(tree)
  $activeProjectId.set(active)
}

async function persistOrRollback(snap: ProjectsSnapshot, write: () => Promise<void>): Promise<void> {
  try {
    await write()
  } catch (err) {
    restoreProjects(snap)
    throw err
  }
}

const reconcileProjects = (): void => {
  void refreshProjects()
  void refreshProjectTree()
}

function projectInfoToTreeNode(project: ProjectInfo): SidebarProjectTree {
  return {
    id: project.id,
    label: project.name || project.id,
    path: project.primary_path ?? project.folders?.[0]?.path ?? null,
    color: project.color ?? null,
    icon: project.icon ?? null,
    isAuto: false,
    repos: [],
    sessionCount: 0,
    previewSessions: []
  }
}

export async function createProject(input: CreateProjectInput): Promise<ProjectInfo | null> {
  if ($projectsRpcAvailable.get() === false) {
    throw projectsStaleBackendError()
  }

  let res: { project: ProjectInfo | null }

  try {
    res = await projectsRpc<{ project: ProjectInfo | null }>('projects.create', {
      name: input.name,
      folders: input.folders ?? [],
      primary_path: input.primaryPath,
      slug: input.slug,
      description: input.description,
      icon: input.icon,
      color: input.color,
      board_slug: input.boardSlug,
      use: input.use ?? false
    })
  } catch (err) {
    if (isMissingRpcMethod(err)) {
      $projectsRpcAvailable.set(false)
      throw projectsStaleBackendError()
    }

    throw err
  }

  markProjectsRpcSuccess()

  const created = res.project

  if (created) {
    if (!$projects.get().some(proj => proj.id === created.id)) {
      $projects.set([...$projects.get(), created])
    }

    if (!$projectTree.get().some(node => node.id === created.id)) {
      $projectTree.set([projectInfoToTreeNode(created), ...$projectTree.get()])
    }

    if (input.use) {
      $activeProjectId.set(created.id)
    }

    // Best-effort IDEA.md seed; the project is created regardless of whether
    // the file lands.
    const ideaFolder = created.primary_path ?? created.folders?.[0]?.path ?? input.primaryPath

    if (ideaFolder && input.idea?.trim()) {
      void window.anakotDesktop?.writeFile?.(
        ideaFolder.endsWith('/') || ideaFolder.endsWith('\\') ? `${ideaFolder}IDEA.md` : `${ideaFolder}/IDEA.md`,
        input.idea.trim()
      )
    }

    setSidebarAgentsGrouped(true)
  }

  reconcileProjects()

  return created
}

export async function renameProject(id: string, name: string): Promise<void> {
  await updateProject(id, { name })
}

export async function updateProject(
  id: string,
  patch: { name?: string; color?: null | string; icon?: null | string }
): Promise<void> {
  const snap = snapshotProjects()

  $projectTree.set(
    snap.tree.map(node =>
      node.id === id
        ? {
            ...node,
            ...(patch.name !== undefined && { label: patch.name }),
            ...(patch.color !== undefined && { color: patch.color }),
            ...(patch.icon !== undefined && { icon: patch.icon })
          }
        : node
    )
  )
  $projects.set(snap.projects.map(proj => (proj.id === id ? { ...proj, ...patch } : proj)))

  await persistOrRollback(snap, () =>
    projectsRpc('projects.update', {
      id,
      ...patch,
      ...(patch.color === null && { color: '' }),
      ...(patch.icon === null && { icon: '' })
    })
  )
}

// Appearance for an AUTO (inherited git-repo) project has no projects.db row to
// write to — its id is just the repo path. The first color/icon change ADOPTS
// the repo as a real project. Returns true when an adoption happened.
export async function setProjectAppearance(
  project: Pick<SidebarProjectTree, 'color' | 'icon' | 'id' | 'isAuto' | 'label' | 'path'>,
  patch: { color?: null | string; icon?: null | string }
): Promise<boolean> {
  if (!project.isAuto) {
    await updateProject(project.id, patch)

    return false
  }

  if (!project.path) {
    return false
  }

  await createProject({
    name: project.label,
    folders: [project.path],
    primaryPath: project.path,
    color: (patch.color ?? project.color) || undefined,
    icon: (patch.icon ?? project.icon) || undefined
  })

  return true
}

export async function addProjectFolder(
  id: string,
  path: string,
  opts: { label?: string; isPrimary?: boolean } = {}
): Promise<void> {
  const snap = snapshotProjects()
  const trimmed = path.trim()

  if (trimmed) {
    const folder = { path: trimmed, label: opts.label ?? null, is_primary: opts.isPrimary ?? false, added_at: 0 }

    $projects.set(
      snap.projects.map(proj => {
        if (proj.id !== id || proj.folders?.some(f => f.path === trimmed)) {
          return proj
        }

        const folders = opts.isPrimary
          ? [folder, ...proj.folders.map(f => ({ ...f, is_primary: false }))]
          : [...proj.folders, folder]

        return { ...proj, folders, ...(opts.isPrimary && { primary_path: trimmed }) }
      })
    )

    if (opts.isPrimary) {
      $projectTree.set(snap.tree.map(node => (node.id === id ? { ...node, path: trimmed } : node)))
    }
  }

  await persistOrRollback(snap, () =>
    projectsRpc('projects.add_folder', { id, path, label: opts.label, is_primary: opts.isPrimary ?? false })
  )
  reconcileProjects()
}

// True when the session currently open in the main pane belongs to `projectId`.
function openSessionBelongsToProject(projectId: string, projects: ProjectInfo[]): boolean {
  const openId = $selectedStoredSessionId.get()

  if (!openId) {
    return false
  }

  const open = $sessions.get().find(s => sessionMatchesStoredId(s, openId))

  return Boolean(open && liveSessionProjectId(open, projects) === projectId)
}

export async function deleteProject(id: string): Promise<void> {
  const snap = snapshotProjects()
  const kickToIntro = openSessionBelongsToProject(id, snap.projects)

  $projects.set(snap.projects.filter(project => project.id !== id))
  $projectTree.set(snap.tree.filter(node => node.id !== id))

  if (snap.active === id) {
    $activeProjectId.set(null)
  }

  if (kickToIntro) {
    $freshSessionRequest.set($freshSessionRequest.get() + 1)
  }

  await persistOrRollback(snap, async () => {
    applyPayload(await projectsRpc<ProjectsPayloadFull>('projects.delete', { id }))
  })
  void refreshProjectTree()
}

export async function setActiveProject(id: null | string): Promise<void> {
  const res = await projectsRpc<{ active_id: null | string }>('projects.set_active', { id })
  $activeProjectId.set(res.active_id ?? null)
}

// ── Project management dialog ───────────────────────────────────────────────
export interface ProjectDialogState {
  mode: 'add-folder' | 'create' | 'rename'
  projectId?: string
  name?: string
}

export const $projectDialog = atom<null | ProjectDialogState>(null)

export function openProjectCreate(): void {
  if ($projectsRpcAvailable.get() === false) {
    notify({
      kind: 'warning',
      message: translateNow('sidebar.projects.staleBackend')
    })

    return
  }

  $projectDialog.set({ mode: 'create' })
}

export function openProjectRename(project: { id: string; name: string }): void {
  $projectDialog.set({ mode: 'rename', name: project.name, projectId: project.id })
}

export function openProjectAddFolder(project: { id: string; name: string }): void {
  $projectDialog.set({ mode: 'add-folder', name: project.name, projectId: project.id })
}

export function closeProjectDialog(): void {
  $projectDialog.set(null)
}

// ── Git-driven worktrees ("Start work") ─────────────────────────────────────
export const $worktreeRefreshToken = atom(0)
const bumpWorktrees = () => $worktreeRefreshToken.set($worktreeRefreshToken.get() + 1)

export function refreshWorktrees(): void {
  bumpWorktrees()
}

// Spin up a fresh worktree the lightest way (`git worktree add -b`) under the
// repo, returning where work should start. Git is the source of truth.
export async function startWorkInRepo(
  repoPath: string,
  options?: { name?: string; branch?: string; base?: string; existingBranch?: string }
): Promise<null | { path: string; branch: string }> {
  const git = desktopGit()

  if (!git || !repoPath) {
    return null
  }

  const result = await git.worktreeAdd(repoPath, options)
  bumpWorktrees()

  return { branch: result.branch, path: result.path }
}

// Local branches for the "convert a branch into a worktree" picker.
export async function listRepoBranches(repoPath: string): Promise<AnakotGitBranch[]> {
  const git = desktopGit()

  if (!git?.branchList || !repoPath) {
    return []
  }

  return git.branchList(repoPath)
}

// Local + remote-tracking branches for the base-branch picker.
export async function listBaseBranches(repoPath: string): Promise<AnakotGitBaseBranch[]> {
  const git = desktopGit()

  if (!git?.baseBranchList || !repoPath) {
    return []
  }

  return git.baseBranchList(repoPath)
}

export async function switchBranchInRepo(repoPath: string, branch: string): Promise<void> {
  const git = desktopGit()

  if (!git || !repoPath || !branch.trim()) {
    return
  }

  await git.branchSwitch(repoPath, branch)
  bumpWorktrees()
}

export interface StartWorkSessionRequest {
  draft?: string
  openTab?: boolean
  path: string
  token: number
}

export const $startWorkSessionRequest = atom<StartWorkSessionRequest | null>(null)

export const $newWorktreeRequest = atom(0)

export function requestNewWorktree(): void {
  $newWorktreeRequest.set($newWorktreeRequest.get() + 1)
}

let startWorkToken = 0

export function requestStartWorkSession(path: string, draft?: string, options?: { openTab?: boolean }): void {
  const target = path.trim()

  if (!target) {
    return
  }

  startWorkToken += 1
  $startWorkSessionRequest.set({
    draft: draft?.trim() || undefined,
    openTab: options?.openTab || undefined,
    path: target,
    token: startWorkToken
  })
}

export async function removeWorktreePath(
  repoPath: string,
  worktreePath: string,
  options?: { force?: boolean }
): Promise<void> {
  const git = desktopGit()

  if (!git) {
    return
  }

  await git.worktreeRemove(repoPath, worktreePath, options)
  bumpWorktrees()
}

// Reveal a project/worktree path in the OS file manager (git-GUI standard).
export async function revealPath(path: null | string): Promise<void> {
  if (path) {
    await window.anakotDesktop?.revealPath?.(path)
  }
}

// Copy a path to the clipboard (git-GUI standard).
export async function copyPath(path: null | string): Promise<void> {
  if (path) {
    await window.anakotDesktop?.writeClipboard?.(path)
  }
}

// Pick a project folder via the native dialog. Returns the absolute path, or
// null if cancelled.
export async function pickProjectFolder(): Promise<null | string> {
  const desktop = window.anakotDesktop

  if (!desktop) {
    return null
  }

  const [dir] = await desktop.selectPaths?.({ directories: true }) ?? []

  return dir || null
}

// Generate a project idea via the stateless llm.oneshot RPC (inherits the live
// session's model when one exists). Returns "" on failure so the caller can just
// leave the field untouched. The "🎲" affordance in the new-project dialog.
export async function generateProjectIdea(name: string): Promise<string> {
  try {
    const res = await projectsRpc<{ text: string }>('llm.oneshot', {
      instructions:
        'You generate a single, concrete project idea as a short IDEA.md body: a one-line summary, ' +
        'then 3-5 bullet goals. No preamble, no code fences, under 120 words.',
      input: name.trim() ? `Project name: ${name.trim()}` : 'Surprise me with a fun project.',
      temperature: 1.0
    })

    return (res.text || '').trim()
  } catch {
    return ''
  }
}
