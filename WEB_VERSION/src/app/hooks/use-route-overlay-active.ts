import { useLocation } from 'react-router-dom'

import { appViewForPath, isOverlayView } from '@/app/routes'

/**
 * Returns `true` while a full-screen route overlay is active (e.g. /settings,
 * /command-center, /agents, /profiles, /cron).
 *
 * Route overlays render on top of the chat layout. Component overlays (dialogs,
 * command palette) should `return null` when a route overlay is open so they
 * don't fight for z-index / focus while the user configures keys or checks
 * agent activity. The store keeps the component-overlay state alive so it
 * reopens on return, matching the pattern in the Hermes codebase.
 */
export function useRouteOverlayActive(): boolean {
  const { pathname } = useLocation()
  return isOverlayView(appViewForPath(pathname))
}
