/**
 * PluginScope — bridges the desktop's CSS variable system to plugin pages.
 *
 * Plugins use shadcn-style variables (--color-border, --color-card, etc.)
 * while the desktop uses its own --ui-* / --dt-* tokens. This wrapper maps
 * the plugin variables to the desktop's tokens so plugin CSS renders correctly
 * without modifying the plugin bundles.
 */

import { type ReactNode, type CSSProperties } from 'react'

interface PluginScopeProps {
  children: ReactNode
}

export function PluginScope({ children }: PluginScopeProps) {
  return (
    <div
      className="plugin-scope contents"
      style={
        {
          // Map shadcn variables → desktop tokens so plugin CSS works
          '--color-background': 'var(--ui-bg-chrome)',
          '--color-foreground': 'var(--ui-text-primary)',
          '--color-card': 'var(--ui-bg-elevated)',
          '--color-card-foreground': 'var(--ui-text-primary)',
          '--color-muted': 'var(--ui-bg-tertiary)',
          '--color-muted-foreground': 'var(--ui-text-tertiary)',
          '--color-popover': 'var(--ui-bg-elevated)',
          '--color-popover-foreground': 'var(--ui-text-primary)',
          '--color-primary': 'var(--ui-accent-secondary)',
          '--color-primary-foreground': 'var(--dt-primary-foreground)',
          '--color-secondary': 'var(--ui-bg-secondary)',
          '--color-secondary-foreground': 'var(--ui-text-secondary)',
          '--color-accent': 'var(--ui-bg-tertiary)',
          '--color-accent-foreground': 'var(--ui-text-primary)',
          '--color-border': 'var(--ui-stroke-secondary)',
          '--color-input': 'var(--ui-stroke-primary)',
          '--color-ring': 'var(--ui-stroke-primary)',
          '--color-destructive': 'var(--dt-destructive)',
          '--color-destructive-foreground': 'var(--dt-destructive-foreground)',
          '--sidebar-ring': 'var(--ui-stroke-secondary)',
          '--sidebar-border': 'var(--ui-stroke-secondary)',
          '--sidebar-accent-foreground': 'var(--ui-text-primary)',
          '--sidebar-accent': 'var(--ui-bg-tertiary)',
          '--sidebar-primary-foreground': 'var(--ui-text-primary)',
          '--sidebar-primary': 'var(--ui-accent-secondary)',
          '--sidebar-foreground': 'var(--ui-text-secondary)',
          '--sidebar': 'var(--ui-bg-sidebar)',
          '--font-sans': 'var(--dt-font-sans)',
          '--font-mono': 'var(--dt-font-mono)',
          '--radius': 'var(--radius)',
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
