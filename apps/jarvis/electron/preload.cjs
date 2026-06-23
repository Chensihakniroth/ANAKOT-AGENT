const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jarvisAPI', {
  // Gateway
  startGateway: () => ipcRenderer.invoke('gateway-start'),
  stopGateway: () => ipcRenderer.invoke('gateway-stop'),
  getGatewayStatus: () => ipcRenderer.invoke('gateway-status'),
  onGatewayExit: (callback) => ipcRenderer.on('gateway-exit', (_, data) => callback(data)),

  // TTS
  speakText: (text, voice) => ipcRenderer.invoke('tts-speak', text, voice),

  // STT
  transcribeAudio: (audioBase64) => ipcRenderer.invoke('stt-transcribe', audioBase64),

  // App
  getAppInfo: () => ipcRenderer.invoke('app-info'),

  // Platform
  platform: process.platform
})
