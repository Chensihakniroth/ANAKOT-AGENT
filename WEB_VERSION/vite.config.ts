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
              `is \`anakot dashboard\` running? /api calls will 401.`,
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
            `start it with \`anakot dashboard\`. (${(err as Error).message})`,
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
        manualChunks: undefined,
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
