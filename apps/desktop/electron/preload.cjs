const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('anakotDesktop', {
  getConnection: profile => ipcRenderer.invoke('anakot:connection', profile),
  touchBackend: profile => ipcRenderer.invoke('anakot:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('anakot:gateway:ws-url', profile),
  getBootProgress: () => ipcRenderer.invoke('anakot:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('anakot:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('anakot:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('anakot:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('anakot:connection-config:test', payload),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('anakot:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('anakot:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('anakot:connection-config:oauth-logout', remoteUrl),
  profile: {
    get: () => ipcRenderer.invoke('anakot:profile:get'),
    set: name => ipcRenderer.invoke('anakot:profile:set', name)
  },
  api: request => ipcRenderer.invoke('anakot:api', request),
  notify: payload => ipcRenderer.invoke('anakot:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('anakot:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('anakot:readFileDataUrl', filePath),
  readFileText: filePath => ipcRenderer.invoke('anakot:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('anakot:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('anakot:writeClipboard', text),
  saveImageFromUrl: url => ipcRenderer.invoke('anakot:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('anakot:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('anakot:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('anakot:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('anakot:watchPreviewFile', url),
  stopPreviewFileWatch: id => ipcRenderer.invoke('anakot:stopPreviewFileWatch', id),
  setTitleBarTheme: payload => ipcRenderer.send('anakot:titlebar-theme', payload),
  setPreviewShortcutActive: active => ipcRenderer.send('anakot:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('anakot:openExternal', url),
  fetchLinkTitle: url => ipcRenderer.invoke('anakot:fetchLinkTitle', url),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('anakot:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('anakot:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('anakot:setting:defaultProjectDir:pick')
  },
  revealLogs: () => ipcRenderer.invoke('anakot:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('anakot:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('anakot:fs:readDir', dirPath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('anakot:fs:rename', oldPath, newPath),
  deleteFile: filePath => ipcRenderer.invoke('anakot:fs:unlink', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('anakot:fs:writeFile', filePath, content),
  gitRoot: startPath => ipcRenderer.invoke('anakot:fs:gitRoot', startPath),
  gitStatus: cwd => ipcRenderer.invoke('anakot:git:status', cwd),
  gitAdd: (cwd, files) => ipcRenderer.invoke('anakot:git:add', { cwd, files }),
  gitUnstage: (cwd, files) => ipcRenderer.invoke('anakot:git:unstage', { cwd, files }),
  gitDiscard: (cwd, files) => ipcRenderer.invoke('anakot:git:discard', { cwd, files }),
  gitCommit: (cwd, message) => ipcRenderer.invoke('anakot:git:commit', { cwd, message }),
  gitDiff: (cwd, file) => ipcRenderer.invoke('anakot:git:diff', { cwd, file }),
  gitLog: (cwd, limit) => ipcRenderer.invoke('anakot:git:log', { cwd, limit }),
  gitSubscribe: cwd => ipcRenderer.invoke('anakot:git:subscribe', cwd),
  gitUnsubscribe: cwd => ipcRenderer.invoke('anakot:git:unsubscribe', cwd),
  onGitChanged: callback => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('anakot:git:changed', listener)
    return () => ipcRenderer.removeListener('anakot:git:changed', listener)
  },
  onFileChanged: callback => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('anakot:fs:fileChanged', listener)
    return () => ipcRenderer.removeListener('anakot:fs:fileChanged', listener)
  },
  terminal: {
    dispose: id => ipcRenderer.invoke('anakot:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('anakot:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('anakot:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('anakot:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `anakot:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `anakot:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('anakot:close-preview-requested', listener)
    return () => ipcRenderer.removeListener('anakot:close-preview-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('anakot:open-updates', listener)
    return () => ipcRenderer.removeListener('anakot:open-updates', listener)
  },
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('anakot:window-state-changed', listener)
    return () => ipcRenderer.removeListener('anakot:window-state-changed', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('anakot:preview-file-changed', listener)
    return () => ipcRenderer.removeListener('anakot:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('anakot:backend-exit', listener)
    return () => ipcRenderer.removeListener('anakot:backend-exit', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('anakot:power-resume', listener)
    return () => ipcRenderer.removeListener('anakot:power-resume', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('anakot:boot-progress', listener)
    return () => ipcRenderer.removeListener('anakot:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.cjs (apps/desktop/electron/bootstrap-runner.cjs).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('anakot:bootstrap:get'),
  resetBootstrap: () => ipcRenderer.invoke('anakot:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('anakot:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('anakot:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('anakot:bootstrap:event', listener)
    return () => ipcRenderer.removeListener('anakot:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('anakot:version'),
  uninstall: {
    summary: () => ipcRenderer.invoke('anakot:uninstall:summary'),
    run: mode => ipcRenderer.invoke('anakot:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('anakot:updates:check'),
    apply: opts => ipcRenderer.invoke('anakot:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('anakot:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('anakot:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('anakot:updates:progress', listener)
      return () => ipcRenderer.removeListener('anakot:updates:progress', listener)
    }
  }
})
