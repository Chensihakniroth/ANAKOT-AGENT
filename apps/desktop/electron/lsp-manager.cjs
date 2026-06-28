// electron/lsp-manager.cjs
// ─────────────────────────────────────────────────────────────────
// Manages Language Server Protocol (LSP) child processes.
// Each language server is spawned with stdio transport and assigned
// a unique session ID. JSON-RPC messages are piped to/from stdin/stdout.
// ─────────────────────────────────────────────────────────────────

const { spawn } = require('node:child_process')
const path = require('node:path')
const crypto = require('node:crypto')

/** @type {Map<string, LspSession>} */
const lspSessions = new Map()

/**
 * @typedef {Object} LspSession
 * @property {string} id
 * @property {string} language
 * @property {import('child_process').ChildProcess} process
 * @property {string} rootUri
 * @property {boolean} initialized
 * @property {Buffer} stdoutBuffer — partial LSP message accumulator
 * @property {((msg: object) => void) | null} onMessage
 * @property {((code: number | null) => void) | null} onExit
 */

// ── Language server command registry ──────────────────────────────
// Maps a Monaco language ID to the command + args needed to start
// its language server in stdio mode.  The user must have the binary
// on PATH.  We probe with `which` / `where` before spawning.

/** @type {Record<string, { cmd: string; args: string[]; altCmd?: string; altArgs?: string[] }>} */
const LANGUAGE_SERVERS = {
  python: {
    cmd: 'pyright-langserver',
    args: ['--stdio'],
    altCmd: 'pylsp',
    altArgs: []
  },
  typescript: {
    cmd: 'typescript-language-server',
    args: ['--stdio']
  },
  javascript: {
    cmd: 'typescript-language-server',
    args: ['--stdio']
  },
  go: {
    cmd: 'gopls',
    args: ['serve']
  },
  rust: {
    cmd: 'rust-analyzer',
    args: []
  },
  c: {
    cmd: 'clangd',
    args: ['--log=error']
  },
  cpp: {
    cmd: 'clangd',
    args: ['--log=error']
  },
  java: {
    cmd: 'jdtls',
    args: []
  },
  lua: {
    cmd: 'lua-language-server',
    args: []
  },
  css: {
    cmd: 'css-languageserver',
    args: ['--stdio']
  },
  html: {
    cmd: 'html-languageserver',
    args: ['--stdio']
  },
  json: {
    cmd: 'vscode-json-languageserver',
    args: ['--stdio']
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Check if a command exists on PATH.
 * @param {string} cmd
 * @returns {boolean}
 */
function commandExists(cmd) {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which'
    const { execFileSync } = require('node:child_process')
    execFileSync(which, [cmd], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Encode a JSON-RPC message with Content-Length header for LSP stdio transport.
 * @param {object} msg
 * @returns {Buffer}
 */
function encodeLspMessage(msg) {
  const body = JSON.stringify(msg)
  const bodyBytes = Buffer.from(body, 'utf-8')
  const header = `Content-Length: ${bodyBytes.length}\r\n\r\n`
  return Buffer.concat([Buffer.from(header, 'ascii'), bodyBytes])
}

/**
 * Parse zero or more complete LSP messages from a buffer.
 * Returns { messages: object[], remaining: Buffer }.
 * @param {Buffer} buffer
 * @returns {{ messages: object[]; remaining: Buffer }}
 */
function parseLspMessages(buffer) {
  const messages = []
  let offset = 0

  while (offset < buffer.length) {
    // Find the header/body separator: \r\n\r\n
    const headerEnd = buffer.indexOf('\r\n\r\n', offset)
    if (headerEnd === -1) break

    // Parse Content-Length from the header block
    const headerBlock = buffer.subarray(offset, headerEnd).toString('ascii')
    const match = headerBlock.match(/Content-Length:\s*(\d+)/i)
    if (!match) {
      // Malformed header — skip past it
      offset = headerEnd + 4
      continue
    }

    const contentLength = parseInt(match[1], 10)
    const bodyStart = headerEnd + 4
    const bodyEnd = bodyStart + contentLength

    if (bodyEnd > buffer.length) {
      // Incomplete body — wait for more data
      break
    }

    try {
      const body = buffer.subarray(bodyStart, bodyEnd).toString('utf-8')
      messages.push(JSON.parse(body))
    } catch {
      // Bad JSON — skip
    }
    offset = bodyEnd
  }

  return { messages, remaining: buffer.subarray(offset) }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Start a language server for the given language.
 * @param {string} language — Monaco language ID (e.g. 'python', 'typescript')
 * @param {string} rootPath — Workspace root path
 * @param {(msg: object) => void} onMessage — Called when the server sends a JSON-RPC message
 * @param {(code: number | null) => void} onExit — Called when the server process exits
 * @returns {{ id: string; language: string } | { error: string }}
 */
function startLsp(language, rootPath, onMessage, onExit) {
  const config = LANGUAGE_SERVERS[language]
  if (!config) {
    return { error: `No language server configured for "${language}"` }
  }

  // Determine which command to use
  let cmd = config.cmd
  let args = config.args
  if (!commandExists(cmd)) {
    if (config.altCmd && commandExists(config.altCmd)) {
      cmd = config.altCmd
      args = config.altArgs || []
    } else {
      return { error: `Language server "${cmd}" not found on PATH. Please install it first.` }
    }
  }

  const id = crypto.randomUUID()
  const proc = spawn(cmd, args, {
    cwd: rootPath || undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    // On Windows, shell: false is default and fine for .exe / .cmd / .bat
    // discoverable via `where`. If the LS is an npm global, `where` finds
    // the .cmd wrapper.
    windowsHide: true
  })

  /** @type {LspSession} */
  const session = {
    id,
    language,
    process: proc,
    rootUri: rootPath ? `file:///${rootPath.replace(/\\/g, '/')}` : '',
    initialized: false,
    stdoutBuffer: Buffer.alloc(0),
    onMessage,
    onExit
  }

  proc.stdout.on('data', (chunk) => {
    session.stdoutBuffer = Buffer.concat([session.stdoutBuffer, chunk])
    const { messages, remaining } = parseLspMessages(session.stdoutBuffer)
    session.stdoutBuffer = remaining
    for (const msg of messages) {
      session.onMessage?.(msg)
    }
  })

  proc.stderr.on('data', (chunk) => {
    // Log stderr for debugging but don't crash
    const text = chunk.toString('utf-8').trim()
    if (text) {
      console.log(`[LSP:${language}:${id.slice(0, 8)}] stderr: ${text.slice(0, 200)}`)
    }
  })

  proc.on('error', (err) => {
    console.error(`[LSP:${language}:${id.slice(0, 8)}] spawn error:`, err.message)
    lspSessions.delete(id)
    session.onExit?.(-1)
  })

  proc.on('exit', (code) => {
    console.log(`[LSP:${language}:${id.slice(0, 8)}] exited with code ${code}`)
    lspSessions.delete(id)
    session.onExit?.(code)
  })

  lspSessions.set(id, session)
  console.log(`[LSP:${language}:${id.slice(0, 8)}] started: ${cmd} ${args.join(' ')}`)
  return { id, language }
}

/**
 * Send a JSON-RPC message to a running language server.
 * @param {string} id — Session ID
 * @param {object} message — JSON-RPC message
 * @returns {{ ok: boolean; error?: string }}
 */
function sendLspMessage(id, message) {
  const session = lspSessions.get(id)
  if (!session) {
    return { ok: false, error: `No LSP session with id "${id}"` }
  }
  if (session.process.killed || !session.process.stdin?.writable) {
    return { ok: false, error: 'LSP process stdin is not writable' }
  }

  try {
    const encoded = encodeLspMessage(message)
    session.process.stdin.write(encoded)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Stop a running language server.
 * @param {string} id — Session ID
 * @returns {{ ok: boolean }}
 */
function stopLsp(id) {
  const session = lspSessions.get(id)
  if (!session) return { ok: false }

  lspSessions.delete(id)
  try {
    session.process.kill('SIGTERM')
  } catch {
    // Already dead
  }
  console.log(`[LSP:${session.language}:${id.slice(0, 8)}] stopped`)
  return { ok: true }
}

/**
 * Stop all running language servers. Called during app shutdown.
 */
function stopAllLsp() {
  for (const [id] of lspSessions) {
    stopLsp(id)
  }
}

/**
 * List languages that have a language server available on PATH.
 * @returns {string[]}
 */
function getAvailableLanguageServers() {
  const available = []
  for (const [lang, config] of Object.entries(LANGUAGE_SERVERS)) {
    if (commandExists(config.cmd) || (config.altCmd && commandExists(config.altCmd))) {
      available.push(lang)
    }
  }
  return available
}

/**
 * List all configured language server entries (even if not installed).
 * @returns {Array<{ language: string; cmd: string; installed: boolean }>}
 */
function listLanguageServers() {
  return Object.entries(LANGUAGE_SERVERS).map(([lang, config]) => {
    const installed = commandExists(config.cmd) || (config.altCmd && commandExists(config.altCmd))
    return { language: lang, cmd: config.cmd, installed }
  })
}

module.exports = {
  startLsp,
  sendLspMessage,
  stopLsp,
  stopAllLsp,
  getAvailableLanguageServers,
  listLanguageServers,
  LANGUAGE_SERVERS
}
