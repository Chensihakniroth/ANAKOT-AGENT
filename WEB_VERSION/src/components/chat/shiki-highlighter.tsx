'use client'

import type { SyntaxHighlighterProps } from '@assistant-ui/react-streamdown'
import type { FC } from 'react'
import ShikiHighlighter from 'react-shiki'

import {
  CodeCard,
  CodeCardBody,
  CodeCardHeader,
  CodeCardIcon,
  CodeCardSubtitle,
  CodeCardTitle
} from '@/components/chat/code-card'
import { DiffLines } from '@/components/chat/diff-lines'
import { CopyButton } from '@/components/ui/copy-button'
import { useI18n } from '@/i18n'
import { codiconForLanguage, isLikelyProseCodeBlock, sanitizeLanguageTag } from '@/lib/markdown-code'

/**
 * Detect if a code block contains diff markers (---/+++ at the start).
 * Used to render unified diff output as a colored diff view instead of
 * a plain syntax-highlighted code block.
 */
function isDiffBlock(language: string | undefined, code: string): boolean {
  if (language === 'diff') return true
  // Auto-detect: look for ---/+++ lines in the first few lines
  if (!language || language === 'text' || language === 'plaintext') {
    const lines = code.trim().split('\n')
    let hasOldFile = false
    let hasNewFile = false
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i]!
      if (line.startsWith('--- ')) hasOldFile = true
      if (line.startsWith('+++ ')) hasNewFile = true
    }
    if (hasOldFile && hasNewFile) return true
    // Also detect if most lines start with +, -, or @@
    if (lines.length > 3) {
      const diffCount = lines.filter(l => /^[+@-]/.test(l)).length
      if (diffCount / lines.length > 0.5) return true
    }
  }
  return false
}

/**
 * Streamdown's code adapter renders header + body as inline siblings, so we
 * own the wrapping `<CodeCard>` here and neutralize the upstream
 * `data-streamdown="code-block"` chrome from styles.css. Anything that wants
 * a card-shaped code surface should compose `CodeCard*` directly.
 *
 * `react-shiki` full bundle so all `bundledLanguages` work; theme switches
 * follow the document `color-scheme` via `defaultColor="light-dark()"`.
 */
interface AnakotSyntaxHighlighterProps extends SyntaxHighlighterProps {
  defer?: boolean
}

const SHIKI_THEME = { dark: 'github-dark-default', light: 'github-light-default' } as const

/**
 * `github-light-default` colors comments `#6e7781` (~4.2:1 against the code
 * card background) — borderline unreadable at our 11px code size, and worst of
 * all for shell snippets where a single `#` turns the rest of the line into one
 * long comment span. Remap light-mode comments to GitHub's darker muted gray
 * (`#57606a`, ~6.4:1). Dark mode (`#8b949e`, ~6.1:1) already reads fine, so we
 * leave it untouched. Keyed per theme name so the bump only applies in light.
 */
const SHIKI_COLOR_REPLACEMENTS: Record<string, Record<string, string>> = {
  'github-light-default': { '#6e7781': '#57606a' }
}

export const SyntaxHighlighter: FC<AnakotSyntaxHighlighterProps> = ({
  components: { Pre },
  language,
  code,
  defer = false
}) => {
  const { t } = useI18n()
  const trimmed = (code ?? '').replace(/^\n+/, '').trimEnd()

  // Streaming may hand us empty/incomplete fences — render nothing rather
  // than a transient empty card.
  if (!trimmed.trim()) {
    return null
  }

  // Detect diff blocks and render them as a colored diff view
  if (isDiffBlock(language, trimmed)) {
    return (
      <CodeCard data-streaming={defer ? 'true' : undefined}>
        <CodeCardHeader>
          <CodeCardTitle>
            <CodeCardIcon name="diff" />
            {t.assistant.tool.code}
            <CodeCardSubtitle> · diff</CodeCardSubtitle>
          </CodeCardTitle>
          <CopyButton
            appearance="inline"
            className="-my-1 -mr-1 h-5 px-1 opacity-55 hover:opacity-100"
            iconClassName="size-2.5"
            label={t.assistant.tool.copyCode}
            showLabel={false}
            text={trimmed}
          />
        </CodeCardHeader>
        <CodeCardBody>
          <DiffLines text={trimmed} />
        </CodeCardBody>
      </CodeCard>
    )
  }

  if (isLikelyProseCodeBlock(language, trimmed)) {
    return <div className="aui-prose-fence whitespace-pre-wrap wrap-anywhere text-foreground">{trimmed}</div>
  }

  const cleanLanguage = sanitizeLanguageTag(language || '')
  const label = cleanLanguage && cleanLanguage !== 'unknown' ? cleanLanguage : ''

  return (
    <CodeCard data-streaming={defer ? 'true' : undefined}>
      <CodeCardHeader>
        <CodeCardTitle>
          <CodeCardIcon name={codiconForLanguage(label)} />
          {t.assistant.tool.code}
          {label && <CodeCardSubtitle> · {label}</CodeCardSubtitle>}
        </CodeCardTitle>
        <CopyButton
          appearance="inline"
          className="-my-1 -mr-1 h-5 px-1 opacity-55 hover:opacity-100"
          iconClassName="size-2.5"
          label={t.assistant.tool.copyCode}
          showLabel={false}
          text={trimmed}
        />
      </CodeCardHeader>
      <CodeCardBody>
        <Pre className="aui-shiki m-0 overflow-hidden bg-transparent p-0">
          {defer ? (
            <code className="block whitespace-pre">{trimmed}</code>
          ) : (
            <ShikiHighlighter
              addDefaultStyles={false}
              as="div"
              colorReplacements={SHIKI_COLOR_REPLACEMENTS}
              defaultColor="light-dark()"
              delay={120}
              language={language || 'text'}
              showLanguage={false}
              theme={SHIKI_THEME}
            >
              {trimmed}
            </ShikiHighlighter>
          )}
        </Pre>
      </CodeCardBody>
    </CodeCard>
  )
}
