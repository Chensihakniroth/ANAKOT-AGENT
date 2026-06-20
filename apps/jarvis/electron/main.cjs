const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeTheme,
  shell,
  dialog
} = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// ── Paths ────────────────────────────────────────────────────────────────────

const APP_ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(APP_ROOT, 'dist')
const ASSETS_DIR = path.join(APP_ROOT, 'assets')
const VITE_DEV_URL = 'http://127.0.0.1:5175'

// ── State ────────────────────────────────────────────────────────────────────

/** @type {BrowserWindow|null} */
let mainWindow = null

/** @type {import('child_process').ChildProcess|null} */
let gatewayProcess = null

/** @type {number} */
let gatewayPort = 0

/** @type {string} */
let gatewayTicket = ''

// ── Gateway ──────────────────────────────────────────────────────────────────

/**
 * Find a free port for the gateway WebSocket.
 * @returns {Promise<number>}
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/**
 * Start the Anakot TUI gateway as a child process.
 * @returns {Promise<{port: number, ticket: string}>}
 */
async function startGateway() {
  if (gatewayProcess) {
    return { port: gatewayPort, ticket: gatewayTicket }
  }

  const port = await findFreePort()
  const ticket = require('crypto').randomBytes(16).toString('hex')

  // Find the Python executable from the venv
  const venvPython = process.platform === 'win32'
    ? path.join(APP_ROOT, '..', '.venv', 'Scripts', 'python.exe')
    : path.join(APP_ROOT, '..', '.venv', 'bin', 'python')

  const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python'

  console.log(`[Gateway] Starting on port ${port}...`)
  console.log(`[Gateway] Python: ${pythonExe}`)

  const proc = spawn(pythonExe, ['-m', 'tui_gateway.entry'], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      ANAKOT_TUI_GATEWAY_PORT: String(port),
      ANAKOT_TUI_GATEWAY_TICKET: ticket,
      ANAKOT_TUI_SIDECAR_URL: `ws://127.0.0.1:${port}`,
      PYTHONUNBUFFERED: '1'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  gatewayProcess = proc
  gatewayPort = port
  gatewayTicket = ticket

  proc.stdout.on('data', (data) => {
    console.log(`[Gateway stdout] ${data.toString().trim()}`)
  })

  proc.stderr.on('data', (data) => {
    console.error(`[Gateway stderr] ${data.toString().trim()}`)
  })

  proc.on('exit', (code, signal) => {
    console.log(`[Gateway] Exited code=${code} signal=${signal}`)
    gatewayProcess = null
    gatewayPort = 0
    gatewayTicket = ''
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-exit', { code, signal })
    }
  })

  // Wait for gateway to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Gateway startup timed out after 15s'))
    }, 15000)

    const check = setInterval(async () => {
      try {
        await probeGateway(port)
        clearInterval(check)
        clearTimeout(timeout)
        console.log(`[Gateway] Ready on port ${port}`)
        resolve()
      } catch {
        // Not ready yet
      }
    }, 500)

    proc.on('exit', (code) => {
      if (code !== 0) {
        clearInterval(check)
        clearTimeout(timeout)
        reject(new Error(`Gateway exited with code ${code}`))
      }
    })
  })

  return { port, ticket }
}

/**
 * Probe the gateway WebSocket to check if it's ready.
 */
function probeGateway(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve()
      } else {
        reject(new Error(`Status ${res.statusCode}`))
      }
    })
    req.on('error', reject)
    req.setTimeout(2000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

/**
 * Stop the gateway process.
 */
function stopGateway() {
  if (gatewayProcess) {
    console.log('[Gateway] Stopping...')
    gatewayProcess.kill('SIGTERM')
    gatewayProcess = null
    gatewayPort = 0
    gatewayTicket = ''
  }
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'J.A.R.V.I.S.',
    icon: path.join(ASSETS_DIR, 'icon.png'),
    backgroundColor: '#0a0a14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    // Frameless window for HUD look (optional — can be toggled)
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a14',
      symbolColor: '#00e5ff',
      height: 36
    }
  })

  // Load the renderer
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'
  if (isDev) {
    mainWindow.loadURL(VITE_DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(DIST_DIR, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('gateway-start', async () => {
  try {
    const { port, ticket } = await startGateway()
    return { ok: true, port, ticket, url: `ws://127.0.0.1:${port}/ws` }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('gateway-stop', () => {
  stopGateway()
  return { ok: true }
})

ipcMain.handle('gateway-status', () => {
  return {
    running: gatewayProcess !== null && !gatewayProcess.killed,
    port: gatewayPort,
    ticket: gatewayTicket
  }
})

// TTS: speak text via edge-tts
ipcMain.handle('tts-speak', async (event, text, voice = 'en-US-AndrewNeural') => {
  try {
    const { execFileSync } = require('node:child_process')
    const tmpFile = path.join(os.tmpdir(), `jarvis-tts-${Date.now()}.mp3`)

    execFileSync('edge-tts', [
      '--voice', voice,
      '--text', text,
      '--write-media', tmpFile
    ], { timeout: 30000 })

    // Read the file and return as base64
    const audioData = fs.readFileSync(tmpFile)
    fs.unlinkSync(tmpFile)

    return { ok: true, audio: audioData.toString('base64'), format: 'mp3' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// STT: transcribe audio via whisper (placeholder — needs Python backend)
ipcMain.handle('stt-transcribe', async (event, audioBase64) => {
  // TODO: Send to Python whisper backend
  return { ok: false, error: 'STT not yet implemented' }
})

// App info
ipcMain.handle('app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Set dark theme
  nativeTheme.themeSource = 'dark'

  // Create menu (minimal)
  Menu.setApplicationMenu(null)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopGateway()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopGateway()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
