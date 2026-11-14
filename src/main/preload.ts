import { contextBridge, ipcRenderer } from 'electron'
import { PlaylistItem, SrtConfig, EncodingSettings, BroadcastTelemetry } from '../types'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),

  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('metadata:get', filePath),

  startBroadcast: (playlist: PlaylistItem[], config: SrtConfig, settings: EncodingSettings, currentIdx: number) =>
    ipcRenderer.invoke('broadcast:start', playlist, config, settings, currentIdx),

  stopBroadcast: () => ipcRenderer.invoke('broadcast:stop'),

  updateBroadcastPlaylist: (playlist: PlaylistItem[], currentIdx: number) =>
    ipcRenderer.invoke('broadcast:updatePlaylist', playlist, currentIdx),

  onBroadcastTelemetry: (callback: (telemetry: BroadcastTelemetry) => void) => {
    const handler = (_event: any, telemetry: BroadcastTelemetry) => callback(telemetry)
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
  }
})

