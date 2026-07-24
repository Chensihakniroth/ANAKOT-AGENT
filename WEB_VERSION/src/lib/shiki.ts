/**
 * Shared re-export of react-shiki.
 *
 * Both shiki-highlighter.tsx and preview-file.tsx previously imported
 * react-shiki directly, which caused Vite to generate duplicate shiki
 * language chunks (~6.8 MB wasted). Centralising the import here means
 * both consumers resolve to the same module graph entry, eliminating
 * the duplication.
 */
export { default as ShikiHighlighter, useShikiHighlighter } from 'react-shiki'
