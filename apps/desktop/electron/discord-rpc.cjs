/**
 * Discord Rich Presence integration for Anakot Desktop.
 *
 * Manages the Discord RPC client lifecycle and provides a simple API for
 * the renderer to update the user's presence (activity, state, timestamps).
 *
 * Config (clientId, enabled) is persisted to the desktop's userData dir.
 */

const path = require('node:path')
const fs = require('node:fs')

// ── Config ───────────────────────────────────────────────────────────────

const CONFIG_FILE = 'discord-rpc.json'

let discordRpc = null
let ready = false
let currentActivity = null
let configPath = null
let initPromise = null
let destroyed = false
let connectedUser = null
let lastError = null

// ── Logging ──────────────────────────────────────────────────────────────

function log(...args) {
  console.log('[discord-rpc]', ...args)
}

function warn(...args) {
  console.warn('[discord-rpc]', ...args)
}

// ── Config I/O ──────────────────────────────────────────────────────────

function configFilePath(userDataPath) {
  return path.join(userDataPath, CONFIG_FILE)
}

function loadConfig(userDataPath) {
  const fp = configFilePath(userDataPath)
  try {
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (e) {
    warn('failed to load config:', e.message)
  }
  return { enabled: true, clientId: '' }
}

function saveConfig(userDataPath, cfg) {
  const fp = configFilePath(userDataPath)
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true })
    fs.writeFileSync(fp, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    warn('failed to save config:', e.message)
  }
}

// ── RPC Lifecycle ────────────────────────────────────────────────────────

/**
 * Initialize the Discord RPC client. Must be called after app.whenReady().
 * Safe to call multiple times — subsequent calls update the activity.
 *
 * @param {string} userDataPath - Electron app.getPath('userData')
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function initRpc(userDataPath) {
  if (destroyed) {
    lastError = 'destroyed'
    return { ok: false, reason: 'discord-rpc: destroyed' }
  }

  configPath = userDataPath
  const cfg = loadConfig(userDataPath)

  if (!cfg.enabled) {
    log('disabled by config')
    lastError = 'disabled'
    return { ok: false, reason: 'disabled' }
  }

  const clientId = cfg.clientId && cfg.clientId.trim()

  if (!clientId) {
    log('no clientId configured — Discord Rich Presence requires a Discord Application ID')
    lastError = 'no-client-id'
    return { ok: false, reason: 'no-client-id' }
  }

  // Deduplicate concurrent init calls
  if (initPromise) return initPromise

  initPromise = _doInit(clientId)
  const result = await initPromise
  initPromise = null
  return result
}

async function _doInit(clientId) {
  try {
    // Dev mode: module is hoisted to workspace root node_modules — Node finds
    // it via parent-directory lookup.  Packaged mode: electron-builder cannot
    // reach hoisted deps, so stage-native-deps.cjs copies discord-rpc into
    // resources/native-deps/discord-rpc/; fall back to that path.
    const RPC = (() => {
      try {
        return require('discord-rpc')
      } catch {
        const resourcesPath = process.resourcesPath
        if (resourcesPath) {
          return require(path.join(resourcesPath, 'native-deps', 'discord-rpc'))
        }
        // Last resort — should be unreachable in practice
        throw new Error('discord-rpc module not found (dev: run npm install, packaged: rebuild)')
      }
    })()
    const client = new RPC.Client({ transport: 'ipc' })

    client.on('ready', () => {
      ready = true
      connectedUser = client.user
        ? { username: client.user.username, discriminator: client.user.discriminator ?? '0', avatar: client.user.avatar ?? null }
        : { username: 'unknown', discriminator: '0', avatar: null }
      log('connected as', connectedUser.username)
      // Restore any activity that was set before ready
      if (currentActivity) {
        client.setActivity(currentActivity).catch(e => warn('restore activity failed:', e.message))
      }
    })

    client.on('disconnected', () => {
      ready = false
      connectedUser = null
      log('disconnected')
    })

    // Register the client before connecting (needed on some platforms)
    RPC.register(clientId)

    // Use login() (not connect()) so the 'ready' event fires.
    // login() calls connect() internally, then emits 'ready' when
    // the RPC handshake completes — without this, ready stays false
    // and setActivity/callActivity always return 'not-connected'.
    await client.login({ clientId })
    discordRpc = client
    return { ok: true }
  } catch (e) {
    warn('init failed:', e.message)
    lastError = e.message
    ready = false
    discordRpc = null
    return { ok: false, reason: e.message }
  }
}

/**
 * Set (or update) the Discord Rich Presence activity.
 * Passthrough to discord-rpc's setActivity().
 *
 * @param {object} activity - Discord RPC activity object
 *   { details, state, startTimestamp, endTimestamp, largeImageKey,
 *     largeImageText, smallImageKey, smallImageText, party, buttons, ... }
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function setActivity(activity) {
  currentActivity = activity

  if (!discordRpc || !ready) {
    return { ok: false, reason: 'not-connected' }
  }

  try {
    await discordRpc.setActivity(activity)
    return { ok: true }
  } catch (e) {
    warn('setActivity failed:', e.message)
    return { ok: false, reason: e.message }
  }
}

/**
 * Clear the current activity (user shows as not playing / idle).
 */
async function clearActivity() {
  currentActivity = null
  if (!discordRpc || !ready) return { ok: false, reason: 'not-connected' }
  try {
    await discordRpc.clearActivity()
    return { ok: true }
  } catch (e) {
    warn('clearActivity failed:', e.message)
    return { ok: false, reason: e.message }
  }
}

/**
 * Destroy the RPC client — call on app quit.
 */
async function destroyRpc() {
  destroyed = true
  ready = false
  currentActivity = null
  if (discordRpc) {
    try {
      discordRpc.destroy()
    } catch (e) {
      warn('destroy failed:', e.message)
    }
    discordRpc = null
  }
}

// ── Config API ──────────────────────────────────────────────────────────

function getConfig(userDataPath) {
  return loadConfig(userDataPath || configPath)
}

/**
 * Update config (enabled, clientId) and save. If the RPC was running and
 * changed to disabled, destroy it. If it was disabled and changed to enabled
 * with a clientId, re-init.
 *
 * @param {object} patch - { enabled?: boolean, clientId?: string }
 * @param {string} userDataPath
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function updateConfig(patch, userDataPath) {
  const p = userDataPath || configPath
  if (!p) return { ok: false, reason: 'no userDataPath' }

  const cfg = loadConfig(p)
  const beforeEnabled = cfg.enabled
  const beforeClientId = cfg.clientId

  if (patch.enabled !== undefined) cfg.enabled = patch.enabled
  if (patch.clientId !== undefined) cfg.clientId = patch.clientId

  saveConfig(p, cfg)

  const needsRestart =
    cfg.enabled !== beforeEnabled ||
    (cfg.clientId && cfg.clientId.trim() !== (beforeClientId || '').trim())

  if (needsRestart) {
    // Destroy current client without setting the permanent
    // 'destroyed' flag — that flag is only for app-quit and
    // would block the re-init we're about to do.
    ready = false
    currentActivity = null
    if (discordRpc) {
      try { discordRpc.destroy() } catch (e) { warn('destroy failed:', e.message) }
      discordRpc = null
    }
    if (cfg.enabled && cfg.clientId && cfg.clientId.trim()) {
      return initRpc(p)
    }
  }

  return { ok: true }
}

// ── Presence helpers ────────────────────────────────────────────────────

/**
 * Build a sensible default activity for Anakot.
 *
 * @param {object} opts
 * @param {string} [opts.details] - "Chatting with AI", "Running tasks", "Idle", etc.
 * @param {string} [opts.state] - "Model: GPT-4", session name, etc.
 * @param {number} [opts.startTimestamp] - When this activity started
 * @param {string} [opts.clientId] - Used for the application icon
 * @param {Array<{label: string, url: string}>} [opts.buttons]
 */
function buildDefaultActivity(opts = {}) {
  const activity = {
    details: opts.details || 'Chatting with Anakot',
    state: opts.state || undefined,
    startTimestamp: opts.startTimestamp || Date.now(),
    largeImageKey: 'anakot_logo',
    largeImageText: 'Anakot Agent',
    instance: false,
  }

  // Only add buttons if explicitly provided
  if (opts.buttons && opts.buttons.length > 0) {
    activity.buttons = opts.buttons
  }

  return activity
}

function getConnectionStatus() {
  return {
    connected: ready,
    user: connectedUser,
    error: lastError,
  }
}

// ── Exports ──────────────────────────────────────────────────────────────

module.exports = {
  initRpc,
  setActivity,
  clearActivity,
  destroyRpc,
  getConfig,
  updateConfig,
  buildDefaultActivity,
  getConnectionStatus,
}
