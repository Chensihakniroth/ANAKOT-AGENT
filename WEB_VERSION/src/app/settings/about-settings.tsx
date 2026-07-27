import { useEffect, useState } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { useI18n } from '@/i18n'
import { ExternalLink, GitBranch, Info, HelpCircle, Link2, Cpu } from '@/lib/icons'
import { getVersion } from '@/lib/web-anakot-desktop'

import { SectionHeading, SettingsContent } from './primitives'

const GITHUB_URL = 'https://github.com/Chensihakniroth/ANAKOT-AGENT'
const CHANGELOG_URL = 'https://github.com/Chensihakniroth/ANAKOT-AGENT/releases'
const WEBSITE_URL = 'https://anakot-agent.up.railway.app'

export function AboutSettings() {
  const { t } = useI18n()
  const a = t.settings.about
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    getVersion()
      .then(v => setAppVersion(v?.appVersion ?? null))
      .catch(() => setAppVersion(null))
  }, [])

  return (
    <SettingsContent>
      {/* Brand + version */}
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <BrandMark className="size-16" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{a.heading}</h2>
          <p className="text-xs text-muted-foreground">
            {appVersion ? a.version(appVersion) : a.versionUnavailable}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* What is this about? */}
        <section className="space-y-3">
          <SectionHeading icon={Info} title="About Anakot Agent" />
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Anakot Agent is a self-hosted, multi-user AI agent platform that gives you a
              personal AI assistant with persistent memory, custom skills, and integration
              with multiple AI providers. It supports a web chat interface, Telegram gateways,
              scheduled tasks, and extensible tool backends — all configurable through a
              modern settings panel.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This is the <strong className="text-foreground">web version</strong>, hosted on Railway. It auto-updates
              when the repository receives new changes — no manual updates needed.
            </p>
          </div>
        </section>

        {/* Who made it? */}
        <section className="space-y-3">
          <SectionHeading icon={HelpCircle} title="Who Made It?" />
          <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Anakot Agent was built by{' '}
              <strong className="text-foreground">Mo (Chensihakniroth)</strong> as a fork of the upstream
              Hermes Agent project. The web version includes multi-user support,
              admin controls, and a tailored UI for both administrators and normal users.
            </p>
          </div>
        </section>

        {/* Links */}
        <section className="space-y-3">
          <SectionHeading icon={Link2} title="Useful Links" />
          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GitBranch className="size-3.5" />
              GitHub Repository
              <ExternalLink className="size-3 opacity-50" />
            </a>
            <a
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              href={CHANGELOG_URL}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-3.5" />
              Changelog / Releases
            </a>
            <a
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              href={WEBSITE_URL}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-3.5" />
              Web App Home
            </a>
          </div>
        </section>

        {/* Technical info */}
        <section className="space-y-3">
          <SectionHeading icon={Cpu} title="Technical Details" />
          <div className="space-y-1.5">
            {[
              { label: 'Version', value: appVersion ?? '—', mono: true },
              { label: 'Platform', value: 'Web (Railway)', mono: true },
              { label: 'Auto-updates', value: 'Enabled', mono: true, accent: true },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/15 px-4 py-2.5"
              >
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span
                  className={`text-xs ${item.mono ? 'font-mono' : ''} ${
                    item.accent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground/80'
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SettingsContent>
  )
}
