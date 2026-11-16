import { contextBridge, ipcRenderer } from 'electron'
import { PlaylistItem, SrtConfig, EncodingSettings, BroadcastTelemetry } from '../types'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),

  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  scanRundownFolder: (folderPath: string) => ipcRenderer.invoke('folder:scan', folderPath),

  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('metadata:get', filePath),

  startBroadcast: (channel: 'A' | 'B', playlist: PlaylistItem[], config: SrtConfig, settings: EncodingSettings, currentIdx: number) =>
    ipcRenderer.invoke('broadcast:start', channel, playlist, config, settings, currentIdx),

  stopBroadcast: (channel?: 'A' | 'B') => ipcRenderer.invoke('broadcast:stop', channel),

  switchBroadcastMedia: (channel: 'A' | 'B', clip: PlaylistItem) =>
    ipcRenderer.invoke('broadcast:switchMedia', channel, clip),

  updateBroadcastPlaylist: (channel: 'A' | 'B', playlist: PlaylistItem[], currentIdx: number) =>
    ipcRenderer.invoke('broadcast:updatePlaylist', channel, playlist, currentIdx),

  onBroadcastTelemetry: (callback: (data: { channel: 'A' | 'B'; telemetry: BroadcastTelemetry }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('broadcast:telemetry', handler)
    return () => ipcRenderer.removeListener('broadcast:telemetry', handler)
  },

  toggleSecondaryWindow: () => ipcRenderer.invoke('secondary:toggle'),

  onSecondaryWindowClose: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('secondary:closed', handler)
    return () => ipcRenderer.removeListener('secondary:closed', handler)
  },

  sendToSecondaryWindow: (channel: string, data: any) => {
    ipcRenderer.send('secondary:sync', channel, data)
  },

  onReceiveFromPrimaryWindow: (callback: (channel: string, data: any) => void) => {
    const handler = (_event: any, channel: string, data: any) => callback(channel, data)
    ipcRenderer.on('sync:fromPrimary', handler)
    return () => ipcRenderer.removeListener('sync:fromPrimary', handler)
  },

  isSecondaryWindow: () => {
    return window.location.search.includes('mode=secondary')
  },

  onProxyProgress: (callback: (data: { filePath: string; progress: number; status: 'processing' | 'ready' | 'error' }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('proxy:progress', handler)
    return () => ipcRenderer.removeListener('proxy:progress', handler)
  },

  checkProxyReady: (filePath: string) => ipcRenderer.invoke('proxy:check', filePath),

  generateProxy: (filePath: string) => ipcRenderer.invoke('proxy:generate', filePath),

  onGlobalShortcut: (callback: (shortcut: string) => void) => {
    const handler = (_event: any, key: string) => callback(key)
    ipcRenderer.on('global:shortcut', handler)
    return () => ipcRenderer.removeListener('global:shortcut', handler)
  },

  openLogFile: () => ipcRenderer.invoke('app:openLog'),

  onProxyQueueStatus: (callback: (status: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('proxy:queueStatus', handler)
    return () => ipcRenderer.removeListener('proxy:queueStatus', handler)
  }
})

