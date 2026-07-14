import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { ExternalLink, GitBranch, Info, HelpCircle, Link2, Cpu } from '@/lib/icons'
import { $desktopVersion, refreshDesktopVersion } from '@/store/updates'

import { SectionHeading, SettingsContent } from './primitives'

const GITHUB_URL = 'https://github.com/Chensihakniroth/ANAKOT-AGENT'
const CHANGELOG_URL = 'https://github.com/Chensihakniroth/ANAKOT-AGENT/releases'
const WEBSITE_URL = 'https://anakot-agent.up.railway.app'

export function AboutSettings() {
  const { t } = useI18n()
  const a = t.settings.about
  const version = useStore($desktopVersion)

  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  return (
    <SettingsContent>
      {/* Brand + version */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-6 text-center">
        <BrandMark className="size-16" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{a.heading}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {version?.appVersion ? a.version(version.appVersion) : a.versionUnavailable}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* What is this about? */}
        <section>
          <SectionHeading icon={Info} title="About Anakot Agent" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anakot Agent is a self-hosted, multi-user AI agent platform that gives you a
            personal AI assistant with persistent memory, custom skills, and integration
            with multiple AI providers. It supports a web chat interface, Telegram gateways,
            scheduled tasks, and extensible tool backends — all configurable through a
            modern settings panel.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This is the <strong>web version</strong>, hosted on Railway. It auto-updates
            when the repository receives new changes — no manual updates needed.
          </p>
        </section>

        {/* Who made it? */}
        <section>
          <SectionHeading icon={HelpCircle} title="Who Made It?" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anakot Agent was built by{' '}
            <strong>Mo (Chensihakniroth)</strong> as a fork of the upstream
            Hermes Agent project. The web version includes multi-user support,
            admin controls, and a tailored UI for both administrators and normal users.
          </p>
        </section>

        {/* Links */}
        <section>
          <SectionHeading icon={Link2} title="Useful Links" />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="text">
              <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                <GitBranch className="size-3.5" />
                GitHub Repository
              </a>
            </Button>
            <Button asChild size="sm" variant="text">
              <a href={CHANGELOG_URL} rel="noreferrer" target="_blank">
                <ExternalLink className="size-3.5" />
                Changelog / Releases
              </a>
            </Button>
            <Button asChild size="sm" variant="text">
              <a href={WEBSITE_URL} rel="noreferrer" target="_blank">
                <ExternalLink className="size-3.5" />
                Web App Home
              </a>
            </Button>
          </div>
        </section>

        {/* Technical info */}
        <section>
          <SectionHeading icon={Cpu} title="Technical Details" />
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
              <span>Version</span>
              <span className="font-mono text-foreground/80">
                {version?.appVersion ?? '—'}
              </span>
            </div>
            <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
              <span>Platform</span>
              <span className="font-mono text-foreground/80">Web (Railway)</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
              <span>Auto-updates</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">Enabled</span>
            </div>
          </div>
        </section>
      </div>
    </SettingsContent>
  )
}
