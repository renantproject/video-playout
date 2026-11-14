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
  videoBitrate: number // kbps, e.g. 4500
  audioBitrate: number // kbps, e.g. 128
  preset: string // 'veryfast', 'ultrafast', etc.
  hwaccel: 'cpu' | 'nvenc' | 'qsv' | 'amf'
  gopSize: number
}

export type BroadcastStatus = 'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR' | 'RECONNECTING'

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
  getVideoMetadata: (filePath: string) => Promise<PlaylistItem | null>
  startBroadcast: (playlist: PlaylistItem[], config: SrtConfig, settings: EncodingSettings, currentIdx: number) => Promise<{ success: boolean; message?: string }>
  stopBroadcast: () => Promise<{ success: boolean }>
  updateBroadcastPlaylist: (playlist: PlaylistItem[], currentIdx: number) => Promise<void>
  onBroadcastTelemetry: (callback: (telemetry: BroadcastTelemetry) => void) => () => void
  onSecondaryWindowClose: (callback: () => void) => () => void
  toggleSecondaryWindow: () => Promise<boolean>
  sendToSecondaryWindow: (channel: string, data: any) => void
  onReceiveFromPrimaryWindow: (callback: (channel: string, data: any) => void) => () => void
  isSecondaryWindow: () => boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

