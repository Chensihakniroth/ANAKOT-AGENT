import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const emojibaseDir = (() => {
  try {
    // Hoisted by npm to the workspace root — resolve through node's own
    // lookup so we don't hardcode which of the two node_modules wins.
    return path.dirname(require.resolve('emojibase-data/package.json'))
  } catch {
    return null
  }
})()

const EMOJIBASE_PATH = /^[a-z-]+\/(data|messages|shortcodes\/emojibase)\.json$/

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'hermes:emojibase-assets',
      configureServer(server) {
        server.middlewares.use('/emojibase', (req, res, next) => {
          const rel = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
          if (!emojibaseDir || !EMOJIBASE_PATH.test(rel)) return next()
          fs.readFile(path.join(emojibaseDir, rel), (err, buf) => {
            if (err) return next()
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            res.end(buf)
          })
        })
      },
      generateBundle() {
        if (!emojibaseDir) return
        for (const rel of ['en/data.json', 'en/messages.json', 'en/shortcodes/emojibase.json']) {
          this.emitFile({
            type: 'asset',
            fileName: `emojibase/${rel}`,
            source: fs.readFileSync(path.join(emojibaseDir, rel))
          })
        }
      }
    }
  ],
  build: {
    // Keep desktop packaging stable: Shiki ships many dynamic chunks by
    // default, and electron-builder can OOM scanning thousands of files.
    // Collapsing to a single chunk is intentional, so the renderer bundle is
    // large by design (~22 MB). Raise the warning ceiling above that so the
    // cosmetic "chunk larger than 500 kB" nag stays quiet, while still acting
    // as a regression alarm if the bundle balloons well past today's size.
    chunkSizeWarningLimit: 25000,
    rolldownOptions: {
      output: {
        codeSplitting: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@anakot/shared': path.resolve(__dirname, '../shared/src'),
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      'react/jsx-dev-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime.js'),
      'react/jsx-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-runtime.js')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4174
  }
})