/**
 * Web-compatible shim for `window.anakotDesktop`.
 *
 * Replaces Electron IPC with direct `fetch()` to the same backend that served
 * the page. The session token is injected by the Python server into
 * `window.__ANAKOT_SESSION_TOKEN__` at page-render time (prod) or scraped
 * from the running backend in dev (see `anakotDevToken()` plugin).
 *
 * Electron-only features (terminal, LSP, pet overlay, updates, filesystem,
 * git, etc.) are stubbed with sensible defaults or no-ops.
 */

// ── Types (mirrored from global.d.ts so this file is self-contained) ────────

export interface AnakotConnection {
  baseUrl: string
  isFullscreen: boolean
  mode?: 'local' | 'remote'
  authMode?: 'oauth' | 'token'
  nativeOverlayWidth: number
  source?: 'env' | 'local' | 'settings'
  token: string
  wsUrl: string
  logs: string[]
  profile?: string
  windowButtonPosition: { x: number; y: number } | null
}

interface AnakotApiRequest {
  path: string
  method?: string
  body?: unknown
  timeoutMs?: number
  profile?: string | null
}

interface DesktopBootProgress {
  error: string | null
  fakeMode: boolean
  message: string
  phase: string
  progress: number
  running: boolean
  timestamp: number
}

interface DesktopActiveProfile {
  profile: string | null
}

interface DesktopVersionInfo {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  platform: string
  anakotRoot: string
}

interface DesktopBootstrapState {
  active: boolean
  manifest: null
  stages: Record<string, unknown>
  error: string | null
  log: Array<{ ts: number; stage: string | null; line: string }>
  startedAt: number | null
  completedAt: number | null
  unsupportedPlatform: null
}

type DesktopBootstrapEvent =
  | { type: 'manifest'; stages: unknown[] }
  | { type: 'stage'; name: string; state: string }
  | { type: 'log'; line: string }
  | { type: 'complete' }

// ── Token handling ──────────────────────────────────────────────────────────

const SESSION_HEADER = 'X-Anakot-Session-Token'

function getSessionToken(): string | undefined {
  if (typeof window !== 'undefined') {
    return (window as unknown as Record<string, unknown>).__ANAKOT_SESSION_TOKEN__ as string | undefined
  }
  return undefined
}

function getBasePath(): string {
  if (typeof window !== 'undefined') {
    const bp = (window as unknown as Record<string, unknown>).__ANAKOT_BASE_PATH__ as string | undefined
    if (bp) return bp.startsWith('/') ? bp : `/${bp}`
  }
  return ''
}

// ── Public API ──────────────────────────────────────────────────────────────

export function api<T>(request: AnakotApiRequest): Promise<T> {
  const { path, method = 'GET', body, timeoutMs } = request

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getSessionToken()
  if (token) {
    headers[SESSION_HEADER] = token
  }

  const basePath = getBasePath()
  const url = `${basePath}${path}`

  const controller = new AbortController()
  const timeout = timeoutMs ?? 30_000
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
    credentials: 'include',
  })
    .then((res) => {
      clearTimeout(timeoutId)

      if (res.status === 401) {
        return res.json().then((err) => {
          throw err
        })
      }

      if (!res.ok) {
        return res.text().then((text) => {
          throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`)
        })
      }

      return res.json()
    })
    .catch((err) => {
      clearTimeout(timeoutId)
      throw err
    }) as Promise<T>
}

// ── Connection ──────────────────────────────────────────────────────────────

function buildConnection(profile?: string | null): AnakotConnection {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = window.location.host
  const baseUrl = `${window.location.protocol}//${window.location.host}`
  const basePath = getBasePath()
  const token = getSessionToken()
  const authRequired =
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__ANAKOT_AUTH_REQUIRED__

  return {
    baseUrl,
    isFullscreen: false,
    mode: 'local',
    authMode: authRequired ? 'oauth' : 'token',
    nativeOverlayWidth: 0,
    source: 'local',
    token: token ?? '',
    wsUrl: `${protocol}//${wsHost}${basePath}/api/ws${authRequired ? '' : token ? `?token=${encodeURIComponent(token)}` : ''}`,
    logs: [],
    profile: profile ?? undefined,
    windowButtonPosition: null,
  }
}

export function getConnection(profile?: string | null): Promise<AnakotConnection> {
  return Promise.resolve(buildConnection(profile))
}

export function touchBackend(_profile?: string | null): Promise<{ ok: boolean }> {
  return Promise.resolve({ ok: true })
}

export function getGatewayWsUrl(_profile?: string | null): Promise<string> {
  const conn = buildConnection(_profile)
  return Promise.resolve(conn.wsUrl)
}

// ── Profile ─────────────────────────────────────────────────────────────────

export const profile = {
  get: (): Promise<DesktopActiveProfile> => Promise.resolve({ profile: null }),
  set: (_name: string | null): Promise<DesktopActiveProfile> => Promise.resolve({ profile: null }),
}

// ── Boot / bootstrap ────────────────────────────────────────────────────────

export function getBootProgress(): Promise<DesktopBootProgress> {
  return Promise.resolve({
    error: null,
    fakeMode: false,
    message: 'Connected',
    phase: 'renderer.ready',
    progress: 100,
    running: false,
    timestamp: Date.now(),
  })
}

export function getBootstrapState(): Promise<DesktopBootstrapState> {
  return Promise.resolve({
    active: false,
    manifest: null,
    stages: {},
    error: null,
    log: [],
    startedAt: null,
    completedAt: Date.now(),
    unsupportedPlatform: null,
  })
}

export function resetBootstrap(): Promise<{ ok: boolean }> {
  return Promise.resolve({ ok: true })
}

export function repairBootstrap(): Promise<{ ok: boolean }> {
  return Promise.resolve({ ok: true })
}

export function cancelBootstrap(): Promise<{ ok: boolean; cancelled: boolean }> {
  return Promise.resolve({ ok: true, cancelled: true })
}

export function getVersion(): Promise<DesktopVersionInfo> {
  return Promise.resolve({
    appVersion: 'web-0.15.1',
    electronVersion: '0.0.0',
    nodeVersion: '0.0.0',
    platform: navigator.platform || 'web',
    anakotRoot: '',
  })
}

// ── Notifications ──────────────────────────────────────────────────────────

export function notify(payload: {
  title?: string
  body?: string
  silent?: boolean
  type?: string
  sessionId?: string
}): Promise<boolean> {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(payload.title ?? 'Anakot', {
      body: payload.body,
      silent: payload.silent ?? true,
    })
  }
  return Promise.resolve(true)
}

export function getNotificationPrefs(): Promise<{
  message: boolean
  task_complete: boolean
  update: boolean
  error: boolean
  info: boolean
}> {
  return Promise.resolve({
    message: true,
    task_complete: true,
    update: false,
    error: true,
    info: false,
  })
}

export function setNotificationPrefs(
  _prefs: Partial<{
    message: boolean
    task_complete: boolean
    update: boolean
    error: boolean
    info: boolean
  }>
): Promise<{
  message: boolean
  task_complete: boolean
  update: boolean
  error: boolean
  info: boolean
}> {
  return getNotificationPrefs()
}

// ── Window (no-ops in web) ─────────────────────────────────────────────────

export function setWindowOpacity(_opacity: number): Promise<number | null> {
  return Promise.resolve(null)
}

export function getWindowOpacity(): Promise<number> {
  return Promise.resolve(1)
}

export function requestMicrophoneAccess(): Promise<boolean> {
  return navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((t) => t.stop())
      return true
    })
    .catch(() => false)
}

export function setTitleBarTheme(_payload: { background: string; foreground: string }): void {
  /* no-op */
}

export function setPreviewShortcutActive(_active: boolean): void {
  /* no-op */
}

export function openExternal(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer')
  return Promise.resolve()
}

// ── Clipboard (browser native) ─────────────────────────────────────────────

export function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

// ── File system (stubs — web has no local fs access) ───────────────────────

export function readFileText(_filePath: string): Promise<{
  binary?: boolean
  byteSize?: number
  language?: string
  mimeType?: string
  path: string
  text: string
  truncated?: boolean
}> {
  return Promise.reject(new Error('File system not available in web version'))
}

export function readFileDataUrl(_filePath: string): Promise<string> {
  return Promise.reject(new Error('File system not available in web version'))
}

export function selectPaths(_options?: {
  title?: string
  defaultPath?: string
  directories?: boolean
  multiple?: boolean
}): Promise<string[]> {
  return Promise.resolve([])
}

export function saveImageFromUrl(_url: string): Promise<boolean> {
  return Promise.resolve(false)
}

export function saveImageBuffer(_data: ArrayBuffer | Uint8Array, _ext: string): Promise<string> {
  return Promise.reject(new Error('File system not available in web version'))
}

export function saveClipboardImage(): Promise<string> {
  return Promise.reject(new Error('File system not available in web version'))
}

export function getPathForFile(_file: File): string {
  return ''
}

export function normalizePreviewTarget(
  _target: string,
  _baseDir?: string
): Promise<{
  binary?: boolean
  byteSize?: number
  kind: 'file' | 'url'
  label: string
  large?: boolean
  language?: string
  mimeType?: string
  path?: string
  previewKind?: 'binary' | 'html' | 'image' | 'text'
  renderMode?: 'preview' | 'source'
  source: string
  url: string
} | null> {
  return Promise.resolve(null)
}

export function watchPreviewFile(_url: string): Promise<{ id: string; path: string }> {
  return Promise.resolve({ id: '', path: '' })
}

export function stopPreviewFileWatch(_id: string): Promise<boolean> {
  return Promise.resolve(true)
}

export function renameFile(_oldPath: string, _newPath: string): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Not available in web version' })
}

export function deleteFile(_path: string): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Not available in web version' })
}

export function writeFile(_path: string, _content: string): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Not available in web version' })
}

export function readDir(_path: string): Promise<{
  entries: Array<{ name: string; path: string; isDirectory: boolean }>
  error?: string
}> {
  return Promise.resolve({
    entries: [],
    error: 'Not available in web version',
  })
}

export function revealLogs(): Promise<{ ok: boolean; path: string; error?: string }> {
  return Promise.resolve({ ok: true, path: '', error: 'Not available in web version' })
}

export function getRecentLogs(): Promise<{ path: string; lines: string[] }> {
  return Promise.resolve({ path: '', lines: [] })
}

export function fetchLinkTitle(url: string): Promise<string> {
  return fetch(url, { method: 'HEAD' })
    .then(() => url)
    .catch(() => url)
}

// ── Settings ────────────────────────────────────────────────────────────────

export const settings = {
  getDefaultProjectDir: (): Promise<{ defaultLabel: string; dir: null | string }> =>
    Promise.resolve({ defaultLabel: 'Home', dir: null }),
  pickDefaultProjectDir: (): Promise<{ canceled: boolean; dir: null | string }> =>
    Promise.resolve({ canceled: true, dir: null }),
  setDefaultProjectDir: (_dir: null | string): Promise<{ dir: null | string }> =>
    Promise.resolve({ dir: null }),
}

// ── Git (stubs) ─────────────────────────────────────────────────────────────

export function gitRoot(_path: string): Promise<string | null> {
  return Promise.resolve(null)
}

export function gitStatus(_cwd: string): Promise<{
  root: string | null
  files: Array<{ path: string; status: string; staged: boolean; unstaged: boolean }>
  branch: string
  error?: string
}> {
  return Promise.resolve({
    root: null,
    files: [],
    branch: '',
    error: 'Git not available in web version',
  })
}

export function gitAdd(
  _cwd: string,
  _files: string[]
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitUnstage(
  _cwd: string,
  _files: string[]
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitDiscard(
  _cwd: string,
  _files: string[]
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitCommit(
  _cwd: string,
  _message: string
): Promise<{ ok: boolean; output?: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitPush(_cwd: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitCommitAmend(
  _cwd: string,
  _message: string
): Promise<{ ok: boolean; output?: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitDiff(
  _cwd: string,
  _file: string
): Promise<{ ok: boolean; diff: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version', diff: '' })
}

export function gitStagedDiff(_cwd: string): Promise<{ ok: boolean; diff: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version', diff: '' })
}

export function gitLog(
  _cwd: string,
  _limit?: number
): Promise<{
  ok: boolean
  commits: Array<{ hash: string; name: string; email: string; date: string; message: string }>
  error?: string
}> {
  return Promise.resolve({
    ok: false,
    commits: [],
    error: 'Git not available in web version',
  })
}

export function gitBranches(
  _cwd: string
): Promise<{
  ok: boolean
  branches: Array<{ name: string; current: boolean }>
  error?: string
}> {
  return Promise.resolve({ ok: false, branches: [], error: 'Git not available in web version' })
}

export function gitCheckout(
  _cwd: string,
  _branch: string
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitCheckoutNewBranch(
  _cwd: string,
  _branch: string
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitSubscribe(
  _cwd: string
): Promise<{ ok: boolean; root?: string; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function gitUnsubscribe(
  _cwd: string
): Promise<{ ok: boolean; error?: string }> {
  return Promise.resolve({ ok: false, error: 'Git not available in web version' })
}

export function onGitChanged(_callback: (data: { root: string }) => void): () => void {
  return () => { /* no-op */ }
}

export function onFileChanged(_callback: (data: { path: string; root: string }) => void): () => void {
  return () => { /* no-op */ }
}

// ── Terminal (stubs) ────────────────────────────────────────────────────────

export const terminal = {
  dispose: (_id: string): Promise<boolean> => Promise.resolve(true),
  onData: (_id: string, _callback: (payload: string) => void): () => void => () => { /* no-op */ },
  onExit: (
    _id: string,
    _callback: (payload: { code: number | null; signal: string | null }) => void
  ): () => void => () => { /* no-op */ },
  resize: (_id: string, _size: { cols: number; rows: number }): Promise<boolean> =>
    Promise.resolve(true),
  start: (
    _options?: { cols?: number; cwd?: string; rows?: number; shell?: string }
  ): Promise<{
    cwd: string
    id: string
    shell: string
  }> => Promise.resolve({ cwd: '', id: '', shell: '' }),
  write: (_id: string, _data: string): Promise<boolean> => Promise.resolve(true),
}

// ── LSP (stubs) ────────────────────────────────────────────────────────────

export const lsp = {
  start: (_language: string, _rootPath: string): Promise<{ id: string; language: string; error?: never } | { error: string; id?: never; language?: never }> =>
    Promise.resolve({ error: 'LSP not available in web version' }),
  send: (_id: string, _message: object): Promise<{ ok: boolean; error?: string }> =>
    Promise.resolve({ ok: false, error: 'LSP not available in web version' }),
  stop: (_id: string): Promise<{ ok: boolean }> =>
    Promise.resolve({ ok: true }),
  available: (): Promise<string[]> =>
    Promise.resolve([]),
  list: (): Promise<Array<{ language: string; cmd: string; installed: boolean }>> =>
    Promise.resolve([]),
  onMessage: (_id: string, _callback: (msg: object) => void): (() => void) =>
    () => { /* no-op */ },
  onExit: (_id: string, _callback: (payload: { code: number | null }) => void): (() => void) =>
    () => { /* no-op */ },
}

// ── Obsidian (stubs) ────────────────────────────────────────────────────────

export function getObsidianVaultPath(): Promise<{ ok: boolean; path: string }> {
  return Promise.resolve({ ok: false, path: '' })
}

export function scanObsidianVault(_rootPath: string): Promise<{
  ok: boolean
  rootPath?: string
  error?: string
  graph: {
    nodes: Array<{ id: string; name: string; path: string; group: string; size: number }>
    links: Array<{ source: string; target: string }>
  }
}> {
  return Promise.resolve({
    ok: false,
    error: 'Obsidian not available in web version',
    graph: { nodes: [], links: [] },
  })
}

// ── Pet overlay (stubs) ─────────────────────────────────────────────────────

export const petOverlay = {
  open: (
    _request?: {
      bounds?: { x: number; y: number; width: number; height: number }
      screen?: boolean
      show?: boolean
      centerToPet?: boolean
      skipLoad?: boolean
    }
  ): Promise<{ ok: boolean; bounds?: { x: number; y: number; width: number; height: number } }> =>
    Promise.resolve({ ok: false }),
  close: (): Promise<{ ok: boolean }> => Promise.resolve({ ok: true }),
  setBounds: (_bounds: { x: number; y: number; width: number; height: number }): void => {
    /* no-op */
  },
  setIgnoreMouse: (_ignore: boolean): void => {
    /* no-op */
  },
  setFocusable: (_focusable: boolean): void => {
    /* no-op */
  },
  pushState: (_payload: Record<string, unknown>): void => {
    /* no-op */
  },
  control: (_payload: Record<string, unknown>): void => {
    /* no-op */
  },
  onState: (_callback: (payload: Record<string, unknown>) => void): (() => void) =>
    () => { /* no-op */ },
  onControl: (_callback: (action: Record<string, unknown>) => void): (() => void) =>
    () => { /* no-op */ },
}

// ── Updates (stubs) ─────────────────────────────────────────────────────────

export const updates = {
  check: (): Promise<{
    supported: boolean
    error?: string
    message?: string
  }> => Promise.resolve({ supported: false, message: 'Not available in web version' }),
  apply: (): Promise<{
    ok: boolean
    error?: string
    message?: string
  }> => Promise.resolve({ ok: false, error: 'Not available in web version' }),
  getBranch: (): Promise<{ branch: string }> => Promise.resolve({ branch: 'web' }),
  setBranch: (_name: string): Promise<{ branch: string }> => Promise.resolve({ branch: 'web' }),
  onProgress: (
    _callback: (payload: {
      stage: string
      message: string
      percent: number | null
      error: string | null
    }) => void
  ): (() => void) => () => { /* no-op */ },
}

// ── Uninstall (stubs) ───────────────────────────────────────────────────────

export const uninstall = {
  summary: (): Promise<{
    anakot_home: string
    agent_installed: boolean
    gui_installed: boolean
    source_built_artifacts: string[]
    packaged_app_paths: string[]
  }> =>
    Promise.resolve({
      anakot_home: '',
      agent_installed: false,
      gui_installed: false,
      source_built_artifacts: [],
      packaged_app_paths: [],
    }),
  run: (
    _mode: 'full' | 'gui' | 'lite'
  ): Promise<{
    ok: boolean
    error?: string
    message?: string
  }> => Promise.resolve({ ok: true, message: 'Nothing to uninstall in web version' }),
}

// ── Event listeners (no-ops) ────────────────────────────────────────────────

export function onClosePreviewRequested(_callback: () => void): () => void {
  return () => { /* no-op */ }
}

export function onOpenUpdatesRequested(_callback: () => void): () => void {
  return () => { /* no-op */ }
}

export function onWindowStateChanged(
  _callback: (payload: { isFullscreen: boolean }) => void
): () => void {
  return () => { /* no-op */ }
}

export function onPreviewFileChanged(
  _callback: (payload: { id: string; path: string; url: string }) => void
): () => void {
  return () => { /* no-op */ }
}

export function onBackendExit(
  _callback: (payload: { code: number | null; signal: string | null }) => void
): () => void {
  return () => { /* no-op */ }
}

export function onPowerResume(_callback: () => void): () => void {
  return () => { /* no-op */ }
}

export function onBootProgress(
  _callback: (payload: DesktopBootProgress) => void
): () => void {
  return () => { /* no-op */ }
}

export function onBootstrapEvent(
  _callback: (payload: DesktopBootstrapEvent) => void
): () => void {
  return () => { /* no-op */ }
}

// ── Connection config (stubs) ───────────────────────────────────────────────

export function getConnectionConfig(
  _profile?: string | null
): Promise<{
  envOverride: boolean
  mode: 'local' | 'remote'
  profile: string | null
  remoteAuthMode: 'oauth' | 'token'
  remoteOauthConnected: boolean
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}> {
  return Promise.resolve({
    envOverride: false,
    mode: 'local',
    profile: _profile ?? null,
    remoteAuthMode: 'token',
    remoteOauthConnected: false,
    remoteTokenPreview: null,
    remoteTokenSet: false,
    remoteUrl: '',
  })
}

export function saveConnectionConfig(
  _payload: {
    mode: 'local' | 'remote'
    profile?: string | null
    remoteAuthMode?: 'oauth' | 'token'
    remoteToken?: string
    remoteUrl?: string
  }
): Promise<{
  envOverride: boolean
  mode: 'local' | 'remote'
  profile: string | null
  remoteAuthMode: 'oauth' | 'token'
  remoteOauthConnected: boolean
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}> {
  return Promise.resolve({
    envOverride: false,
    mode: _payload.mode,
    profile: _payload.profile ?? null,
    remoteAuthMode: _payload.remoteAuthMode ?? 'token',
    remoteOauthConnected: false,
    remoteTokenPreview: null,
    remoteTokenSet: false,
    remoteUrl: _payload.remoteUrl ?? '',
  })
}

export function applyConnectionConfig(
  _payload: {
    mode: 'local' | 'remote'
    profile?: string | null
    remoteAuthMode?: 'oauth' | 'token'
    remoteToken?: string
    remoteUrl?: string
  }
): Promise<{
  envOverride: boolean
  mode: 'local' | 'remote'
  profile: string | null
  remoteAuthMode: 'oauth' | 'token'
  remoteOauthConnected: boolean
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}> {
  return saveConnectionConfig(_payload)
}

export function testConnectionConfig(
  _payload: {
    mode: 'local' | 'remote'
    profile?: string | null
    remoteAuthMode?: 'oauth' | 'token'
    remoteToken?: string
    remoteUrl?: string
  }
): Promise<{
  baseUrl: string
  ok: boolean
  version: string | null
}> {
  return Promise.resolve({
    baseUrl: _payload.remoteUrl ?? '',
    ok: false,
    version: null,
  })
}

export function probeConnectionConfig(
  _remoteUrl: string
): Promise<{
  baseUrl: string
  reachable: boolean
  authMode: 'oauth' | 'token' | 'unknown'
  providers: Array<unknown>
  version: string | null
  error: string | null
}> {
  return Promise.resolve({
    baseUrl: _remoteUrl,
    reachable: false,
    authMode: 'unknown',
    providers: [],
    version: null,
    error: 'Not available in web version',
  })
}

export function oauthLoginConnectionConfig(
  _remoteUrl: string
): Promise<{ ok: boolean; baseUrl: string; connected: boolean }> {
  return Promise.resolve({ ok: false, baseUrl: _remoteUrl, connected: false })
}

export function oauthLogoutConnectionConfig(
  _remoteUrl?: string
): Promise<{ ok: boolean; connected: boolean }> {
  return Promise.resolve({ ok: false, connected: false })
}
