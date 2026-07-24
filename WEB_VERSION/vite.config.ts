import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const BACKEND = process.env.ANAKOT_WEB_BACKEND ?? 'http://127.0.0.1:9119'

/**
 * Dev-mode session token injection.
 *
 * In production the Python backend injects `window.__ANAKOT_SESSION_TOKEN__`
 * into index.html. Vite's dev server serves its own HTML, so we scrape the
 * token from the running backend on each page load.
 */
function anakotDevToken(): Plugin {
  const TOKEN_RE = /window\.__ANAKOT_SESSION_TOKEN__\s*=\s*"([^"]+)"/
  return {
    name: 'anakot:dev-session-token',
    apply: 'serve',
    async transformIndexHtml() {
      try {
        const res = await fetch(BACKEND, { headers: { accept: 'text/html' } })
        const html = await res.text()
        const match = html.match(TOKEN_RE)
        if (!match) {
          console.warn(
            `[anakot-web] Could not find session token in ${BACKEND} — ` +
              `is \`anakot dashboard\` running? /api calls will 401.`
          )
          return
        }
        return [
          {
            tag: 'script',
            injectTo: 'head',
            children: `window.__ANAKOT_SESSION_TOKEN__="${match[1]}";`,
          },
        ]
      } catch (err) {
        console.warn(
          `[anakot-web] Backend at ${BACKEND} unreachable — ` +
            `start it with \`anakot dashboard\`. (${(err as Error).message})`
        )
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), anakotDevToken()],
  test: {
    environment: 'jsdom',
    testTimeout: 15_000,
  },
  build: {
    chunkSizeWarningLimit: 25000,
    outDir: '../anakot_cli/web_dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Core React — small but change-frequently; cache separately
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react/jsx-runtime')) {
              return 'vendor-react'
            }
            // Shiki (syntax highlighting) — ALL shiki copies (v3 from @streamdown/code + v4 from react-shiki)
            // Also catch @shikijs/langs which bundles 8MB of TextMate grammar definitions
            if (id.includes('/shiki/') || id.includes('/react-shiki') || id.includes('@shikijs/langs') || id.includes('@shikijs/themes')) {
              return 'vendor-shiki'
            }
            // Monaco editor — very heavy, lazy-loaded
            if (id.includes('/@monaco-editor/') || id.includes('/monaco-editor/')) {
              return 'vendor-monaco'
            }
            // xterm — terminal, lazy-loaded
            if (id.includes('/@xterm/') || id.includes('/xterm/')) {
              return 'vendor-xterm'
            }
            // Mermaid — heavy diagram renderer bundled by streamdown
            if (id.includes('/mermaid')) {
              return 'vendor-mermaid'
            }
            // Streamdown markdown renderer + its rehype/remark chain
            if (id.includes('/streamdown') || id.includes('/@streamdown/') || id.includes('/remark-') || id.includes('/rehype-') || id.includes('/unified') || id.includes('/mdast') || id.includes('/hast-util') || id.includes('/unist-util') || id.includes('/micromark')) {
              return 'vendor-markdown'
            }
            // Tailwind CSS utilities (often large)
            if (id.includes('/tailwindcss') || id.includes('@tailwindcss')) {
              return 'vendor-tailwind'
            }
            // Everything else in node_modules
            return 'vendor'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@anakot/shared': path.resolve(__dirname, '../apps/shared/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: BACKEND,
        ws: true,
      },
      '/ws': {
        target: BACKEND,
        ws: true,
      },
      '/dashboard-plugins': BACKEND,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
})
