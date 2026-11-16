export interface PlaylistItem {
  id: string
  filePath: string
  fileName: string
  duration: number // in seconds
  durationFormatted: string
  resolution: string
  width: number
  height: number
  fps: number
  thumbnail?: string // base64 data url
  fileSize?: number
  format?: string
  needsProxy?: boolean
  isProxyReady?: boolean
  proxyProgress?: number
  groupName?: string // Rundown segment / subfolder name
}

export interface RundownGroup {
  id: string
  name: string // e.g. "HL", "SEG 1", "SEG 2", "SEG 3"
  folderPath: string
  items: PlaylistItem[]
}

export interface RundownProgram {
  name: string // e.g. "KILAS KOMPAS 051224"
  rootPath: string
  groups: RundownGroup[]
}

export type PlaybackMode = 'sequential' | 'loop_item' | 'loop_playlist' | 'manual_cue'

export type SrtMode = 'caller' | 'listener' | 'rendezvous'

export interface SrtConfig {
  mode: SrtMode
  host: string
  port: number
  latency: number // in ms (20 to 8000)
  streamId?: string
  passphrase?: string
  pbkeylen?: 16 | 24 | 32
}

export interface EncodingSettings {
  resolution: string // '1920x1080' | '1280x720' | '3840x2160'
  fps: number // 60, 59.94, 50, 30, 25
  videoBitrate: number // kbps, e.g. 25000 (25 Mbps CBR)
  audioBitrate: number // kbps, e.g. 192
  preset: string // 'ultrafast', 'veryfast', etc.
  hwaccel: 'cpu' | 'nvenc' | 'qsv' | 'amf'
  gopSize: number
  rateControl?: 'CBR' | 'VBR'
  tune?: 'zerolatency' | 'film' | 'none'
}

export type BroadcastStatus = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'LIVE' | 'ERROR' | 'RECONNECTING'

export interface BroadcastTelemetry {
  status: BroadcastStatus
  bitrateKbps: number
  fps: number
  dropFrames: number
  rttMs: number
  bufferHealth: number // 0-100
  speed: string
  uptime: number
  currentClip: string
  errorMessage?: string
}

export interface ElectronAPI {
  openFileDialog: () => Promise<string[]>
  openFolderDialog: () => Promise<RundownProgram | null>
  scanRundownFolder: (folderPath: string) => Promise<RundownProgram | null>
  getVideoMetadata: (filePath: string) => Promise<PlaylistItem | null>
  startBroadcast: (channel: 'A' | 'B', playlist: PlaylistItem[], config: SrtConfig, settings: EncodingSettings, currentIdx: number) => Promise<{ success: boolean; message?: string }>
  stopBroadcast: (channel?: 'A' | 'B') => Promise<{ success: boolean }>
  switchBroadcastMedia: (channel: 'A' | 'B', clip: PlaylistItem) => Promise<{ success: boolean; message?: string }>
  updateBroadcastPlaylist: (channel: 'A' | 'B', playlist: PlaylistItem[], currentIdx: number) => Promise<void>
  onBroadcastTelemetry: (callback: (data: { channel: 'A' | 'B'; telemetry: BroadcastTelemetry }) => void) => () => void
  onSecondaryWindowClose: (callback: () => void) => () => void
  toggleSecondaryWindow: () => Promise<boolean>
  sendToSecondaryWindow: (channel: string, data: any) => void
  onReceiveFromPrimaryWindow: (callback: (channel: string, data: any) => void) => () => void
  isSecondaryWindow: () => boolean
  onProxyProgress: (callback: (data: { filePath: string; progress: number; status: 'processing' | 'ready' | 'error' }) => void) => () => void
  checkProxyReady: (filePath: string) => Promise<boolean>
  generateProxy: (filePath: string) => Promise<string>
  onGlobalShortcut?: (callback: (shortcut: string) => void) => () => void
  openLogFile?: () => Promise<{ success: boolean; path?: string; message?: string }>
  onProxyQueueStatus?: (callback: (status: { total: number; pending: number; active: number; completed: number; currentFile: string }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

