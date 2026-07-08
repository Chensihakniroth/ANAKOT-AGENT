/**
 * dev-desktop.cjs
 *
 * Runs the desktop dev server (Vite renderer + Electron) without the
 * web dashboard. Preserves the user's ANAKOT_HOME environment so the
 * backend uses the project config (D:\\\\School\\\\PROJECT\\\\anakot-agent-home)
 * which has all the custom provider/model settings.
 *
 * Usage:  node scripts/dev-desktop.cjs
 */
const { spawn } = require('node:child_process')
const { resolve } = require('node:path')

const cwd = resolve(__dirname, '..')

const child = spawn(
  'concurrently',
  ['-k', 'npm:dev:renderer', 'npm:dev:electron'],
  {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  }
)

child.on('exit', (code) => process.exit(code ?? 1))
