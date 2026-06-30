/**
 * AchievementsView — wraps the anakot-achievements plugin with proper
 * desktop styling, scrolling, and header integration.
 *
 * The plugin renders assuming a full-page dashboard context with shadcn
 * CSS variables. This wrapper provides:
 * 1. CSS variable bridging (PluginScope) so plugin tokens resolve
 * 2. A scrollable container that respects the overlay's constrained height
 * 3. Desktop-typography overrides so card text feels native
 */

import { lazy, Suspense } from 'react'

import { PluginScope } from './PluginScope'
import { PluginPage } from './PluginPage'

const AchievementsPluginPage = lazy(async () => ({
  default: (await import('./PluginPage')).PluginPage,
}))

export function AchievementsView() {
  return (
    <PluginScope>
      <div className="h-full min-h-0 overflow-y-auto">
        <AchievementsPluginPage name="anakot-achievements" />
      </div>
    </PluginScope>
  )
}
