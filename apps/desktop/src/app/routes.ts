export const SESSION_ROUTE_PREFIX = '/'
export const NEW_CHAT_ROUTE = '/'
export const SETTINGS_ROUTE = '/settings'
export const COMMAND_CENTER_ROUTE = '/command-center'
export const SKILLS_ROUTE = '/skills'
export const MESSAGING_ROUTE = '/messaging'
export const ARTIFACTS_ROUTE = '/artifacts'
export const CRON_ROUTE = '/cron'
export const PROFILES_ROUTE = '/profiles'
export const AGENTS_ROUTE = '/agents'
export const PLUGINS_ROUTE = '/plugins'
export const NOTEBOOK_ROUTE = '/notebook'

export type AppView =
  | 'agents'
  | 'artifacts'
  | 'chat'
  | 'command-center'
  | 'cron'
  | 'messaging'
  | 'notebook'
  | 'profiles'
  | 'settings'
  | 'skills'
  | 'plugins'

export type AppRouteId =
  | 'agents'
  | 'artifacts'
  | 'command-center'
  | 'cron'
  | 'messaging'
  | 'new'
  | 'notebook'
  | 'profiles'
  | 'settings'
  | 'skills'
  | 'plugins'

export interface AppRoute {
  id: AppRouteId
  path: string
  view: AppView
}

export const APP_ROUTES = [
  { id: 'new', path: NEW_CHAT_ROUTE, view: 'chat' },
  { id: 'settings', path: SETTINGS_ROUTE, view: 'settings' },
  { id: 'command-center', path: COMMAND_CENTER_ROUTE, view: 'command-center' },
  { id: 'skills', path: SKILLS_ROUTE, view: 'skills' },
  { id: 'messaging', path: MESSAGING_ROUTE, view: 'messaging' },
  { id: 'notebook', path: NOTEBOOK_ROUTE, view: 'notebook' },
  { id: 'artifacts', path: ARTIFACTS_ROUTE, view: 'artifacts' },
  { id: 'cron', path: CRON_ROUTE, view: 'cron' },
  { id: 'profiles', path: PROFILES_ROUTE, view: 'profiles' },
  { id: 'agents', path: AGENTS_ROUTE, view: 'agents' },
  { id: 'plugins', path: PLUGINS_ROUTE, view: 'plugins' }
] as const satisfies readonly AppRoute[]

const APP_VIEW_BY_PATH = new Map<string, AppView>(APP_ROUTES.map(route => [route.path, route.view]))
const RESERVED_PATHS = new Set<string>(APP_ROUTES.map(route => route.path))
const PLUGIN_PATHS = new Set<string>()

export function registerPluginPaths(paths: string[]) {
  PLUGIN_PATHS.clear()
  for (const p of paths) {
    PLUGIN_PATHS.add(p)
  }
}
// While one is open the app's titlebar control clusters must hide so they don't
// bleed over the overlay (they sit at a higher z-index than the overlay card).
export const OVERLAY_VIEWS: ReadonlySet<AppView> = new Set(['agents', 'command-center', 'cron', 'notebook', 'profiles', 'settings'])

export function isOverlayView(view: AppView | 'plugin-page'): boolean {
  return OVERLAY_VIEWS.has(view as AppView)
}

export function isNewChatRoute(pathname: string): boolean {
  return pathname === NEW_CHAT_ROUTE
}

export function routeSessionId(pathname: string): string | null {
  if (!pathname.startsWith(SESSION_ROUTE_PREFIX) || RESERVED_PATHS.has(pathname) || PLUGIN_PATHS.has(pathname)) {
    return null
  }

  const id = pathname.slice(SESSION_ROUTE_PREFIX.length)

  return id && !id.includes('/') ? decodeURIComponent(id) : null
}

export function sessionRoute(sessionId: string): string {
  return `${SESSION_ROUTE_PREFIX}${encodeURIComponent(sessionId)}`
}

export function appViewForPath(pathname: string): AppView | 'plugin-page' {
  if (PLUGIN_PATHS.has(pathname)) {
    return 'plugin-page'
  }

  if (isNewChatRoute(pathname) || routeSessionId(pathname)) {
    return 'chat'
  }

  return APP_VIEW_BY_PATH.get(pathname) ?? 'chat'
}
