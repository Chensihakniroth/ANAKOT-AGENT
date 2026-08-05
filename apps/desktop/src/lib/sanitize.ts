// String sanitizers for free-text inputs that must stay valid for a target
// format (git refs, slugs). Every keystroke runs through these so callers
// never have to validate-then-reject.
// Ported from Hermes Agent (sanitize.ts).

/** A valid git ref: whitespace → "-", non [A-Za-z0-9_./-] dropped, no double separators, no leading separators. */
export const gitRef = (raw: string): string =>
  raw
    .replace(/\s+/g, '-')
    .replace(/[^\w./-]/g, '') // \w = [A-Za-z0-9_]
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-./]+/, '')

/** A kebab slug: lowercase, runs of non-alphanumerics → a single "-". */
export const slug = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
