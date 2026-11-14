import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { PlaylistItem, SrtConfig, EncodingSettings, BroadcastTelemetry, BroadcastStatus } from '../types'
import { getBinPath } from './ffmpegUtils'
import { getPlayablePath } from './proxyService'

export class FfmpegManager {
  private process: ChildProcess | null = null
  private status: BroadcastStatus = 'IDLE'
  private telemetryCallback: ((telemetry: BroadcastTelemetry) => void) | null = null
  private tempPlaylistPath: string | null = null
  private startTime: number = 0
  private currentClip: string = ''
  private reconnectTimer: NodeJS.Timeout | null = null
  private userStopped: boolean = false
  private currentPlaylist: PlaylistItem[] = []
  private currentConfig: SrtConfig | null = null
  private currentSettings: EncodingSettings | null = null
  private currentIdx: number = 0

  // Telemetry state
  private telemetry: BroadcastTelemetry = {
    status: 'IDLE',
    bitrateKbps: 0,
    fps: 0,
    dropFrames: 0,
    rttMs: 0,
    bufferHealth: 100,
    speed: '0x',
    uptime: 0,
    currentClip: ''
  }

  constructor(telemetryCallback: (telemetry: BroadcastTelemetry) => void) {
    this.telemetryCallback = telemetryCallback
  }

  private updateStatus(newStatus: BroadcastStatus, errorMessage?: string) {
    this.status = newStatus
    this.telemetry.status = newStatus
    if (errorMessage) {
      this.telemetry.errorMessage = errorMessage
    } else {
      delete this.telemetry.errorMessage
    }
    this.emitTelemetry()
  }

  private emitTelemetry() {
    if (this.telemetryCallback) {
      if (this.status === 'LIVE' && this.startTime > 0) {
        this.telemetry.uptime = Math.floor((Date.now() - this.startTime) / 1000)
      }
      this.telemetryCallback({ ...this.telemetry })
    }
  }

  // Create concat playlist file
  private generateConcatPlaylist(items: PlaylistItem[], startIdx: number = 0): string {
    const tempDir = os.tmpdir()
    const playlistFile = path.join(tempDir, `playout_concat_${Date.now()}.txt`)
    
    // Order playlist starting from currentIdx
    const orderedItems = [
      ...items.slice(startIdx),
      ...items.slice(0, startIdx)
    ]

    let content = 'ffconcat version 1.0\n'
    for (const item of orderedItems) {
      // In ffconcat file: use normalized playable proxy path for non-native containers (e.g. MXF)
      const targetPath = getPlayablePath(item.filePath)
      const safePath = targetPath.replace(/\\/g, '/').replace(/'/g, "'\\''")
      content += `file '${safePath}'\n`
    }

    fs.writeFileSync(playlistFile, content, 'utf8')
    return playlistFile
  }

  public async startBroadcast(
    playlist: PlaylistItem[],
    config: SrtConfig,
    settings: EncodingSettings,
    startIdx: number = 0
  ): Promise<{ success: boolean; message?: string }> {
    if (playlist.length === 0) {
      return { success: false, message: 'Antrean playlist kosong. Tambahkan minimal 1 video.' }
    }

    if (this.process) {
      this.stopBroadcast()
    }

    this.userStopped = false
    this.currentPlaylist = playlist
    this.currentConfig = config
    this.currentSettings = settings
    this.currentIdx = startIdx
    this.currentClip = playlist[startIdx]?.fileName || ''

    if (config.mode === 'listener') {
      this.updateStatus('LISTENING')
    } else {
      this.updateStatus('CONNECTING')
    }

    try {
      // Create concat playlist file
      this.tempPlaylistPath = this.generateConcatPlaylist(playlist, startIdx)

      // Build SRT target URL
      // Latency in microseconds: ms * 1000
      const latencyUs = (config.latency || 200) * 1000
      let srtUrl = `srt://${config.host || '127.0.0.1'}:${config.port || 9000}?mode=${config.mode}&transtype=live&latency=${latencyUs}&pkt_size=1316`

      if (config.mode === 'listener') {
        srtUrl = `srt://0.0.0.0:${config.port || 9000}?mode=listener&transtype=live&latency=${latencyUs}&pkt_size=1316`
      }

      if (config.streamId && config.streamId.trim().length > 0) {
        srtUrl += `&streamid=${encodeURIComponent(config.streamId.trim())}`
      }

      if (config.passphrase && config.passphrase.trim().length > 0) {
        srtUrl += `&passphrase=${encodeURIComponent(config.passphrase.trim())}`
        if (config.pbkeylen) {
          srtUrl += `&pbkeylen=${config.pbkeylen}`
        }
      }

      // Scaling and standardization filter
      // E.g. 1920x1080 or custom
      const [w, h] = (settings.resolution || '1920x1080').split('x')
      const targetWidth = parseInt(w) || 1920
      const targetHeight = parseInt(h) || 1080
      const fps = settings.fps || 60

      const videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p`

      // Encoder selection
      let videoCodec = 'libx264'
      const videoArgs: string[] = []

      if (settings.hwaccel === 'nvenc') {
        videoCodec = 'h264_nvenc'
        videoArgs.push('-c:v', videoCodec, '-preset', 'p4', '-tune', 'll')
      } else if (settings.hwaccel === 'qsv') {
        videoCodec = 'h264_qsv'
        videoArgs.push('-c:v', videoCodec, '-preset', 'veryfast')
      } else if (settings.hwaccel === 'amf') {
        videoCodec = 'h264_amf'
        videoArgs.push('-c:v', videoCodec, '-quality', 'speed')
      } else {
        videoCodec = 'libx264'
        videoArgs.push('-c:v', videoCodec, '-preset', settings.preset || 'veryfast')
      }

      const vBitrate = settings.videoBitrate || 4500
      const maxRate = Math.round(vBitrate * 1.15)
      const bufSize = Math.round(vBitrate * 2)
      const gop = settings.gopSize || (fps * 2)

      videoArgs.push(
        '-b:v', `${vBitrate}k`,
        '-maxrate', `${maxRate}k`,
        '-bufsize', `${bufSize}k`,
        '-g', gop.toString()
      )

      const args = [
        '-re', // Real-time playout
        '-f', 'concat',
        '-safe', '0',
        '-i', this.tempPlaylistPath,
        '-vf', videoFilter,
        ...videoArgs,
        '-c:a', 'aac',
        '-b:a', `${settings.audioBitrate || 128}k`,
        '-ar', '48000',
        '-ac', '2',
        '-f', 'mpegts',
        '-progress', 'pipe:1',
        '-stats_period', '0.5',
        srtUrl
      ]

      const ffmpegExe = getBinPath('ffmpeg')
      console.log('Spawning FFmpeg at:', ffmpegExe, 'with args:', args.join(' '))

      this.process = spawn(ffmpegExe, args)
      this.startTime = Date.now()

      // Handle progress pipe stdout
      let stdoutBuffer = ''
      this.process.stdout?.on('data', (chunk) => {
        stdoutBuffer += chunk.toString()
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          this.parseProgressLine(line)
        }
      })

      // Handle stderr for connection state, errors and RTT
      let stderrBuffer = ''
      this.process.stderr?.on('data', (chunk) => {
        const text = chunk.toString()
        stderrBuffer += text
        // In caller or listener mode, detect active output frames
        if ((this.status === 'CONNECTING' || this.status === 'LISTENING') && (text.includes('Output #0, mpegts') || text.includes('frame='))) {
          this.updateStatus('LIVE')
        }

        // Parse possible SRT RTT or drop stats from stderr
        if (text.includes('rtt=')) {
          const match = text.match(/rtt=([\d.]+)/)
          if (match) this.telemetry.rttMs = parseFloat(match[1])
        }
      })

      this.process.on('error', (err) => {
        console.error('FFmpeg process error:', err)
        this.updateStatus('ERROR', err.message)
      })

      this.process.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`)
        this.cleanupTempFile()
        this.process = null

        if (!this.userStopped) {
          if (this.currentConfig?.mode === 'listener') {
            // In listener mode, client (VLC/OBS) disconnected.
            // Automatically re-open the listener socket after 1.5s delay to clear TIME_WAIT.
            console.log('[FFmpegManager] Receiver disconnected in listener mode. Re-listening...')
            this.updateStatus('LISTENING')
            this.attemptReconnect(1500)
          } else {
            if (code === 0) {
              this.updateStatus('IDLE')
            } else {
              this.updateStatus('ERROR', `FFmpeg exited with error code ${code}`)
              this.attemptReconnect(3000)
            }
          }
        } else {
          this.updateStatus('IDLE')
        }
      })

      // In caller mode, if output pipe connects within 2s, mark LIVE
      if (config.mode === 'caller') {
        setTimeout(() => {
          if (this.process && this.status === 'CONNECTING') {
            this.updateStatus('LIVE')
          }
        }, 2000)
      }

      return { success: true }
    } catch (err: any) {
      this.updateStatus('ERROR', err?.message || 'Failed to start broadcast')
      return { success: false, message: err?.message || 'Error launching broadcast' }
    }
  }

  private parseProgressLine(line: string) {
    const parts = line.split('=')
    if (parts.length < 2) return

    const key = parts[0].trim()
    const value = parts[1].trim()

    switch (key) {
      case 'fps':
        this.telemetry.fps = parseFloat(value) || 0
        break
      case 'bitrate': {
        const kbps = parseFloat(value.replace('kbits/s', ''))
        if (!isNaN(kbps)) this.telemetry.bitrateKbps = Math.round(kbps)
        break
      }
      case 'drop_frames':
        this.telemetry.dropFrames = parseInt(value, 10) || 0
        break
      case 'speed':
        this.telemetry.speed = value
        break
      case 'progress':
        if (value === 'continue' && this.status !== 'LIVE') {
          this.updateStatus('LIVE')
        }
        this.telemetry.currentClip = this.currentClip
        this.telemetry.bufferHealth = Math.min(100, Math.max(20, Math.round(100 - (this.telemetry.dropFrames * 2))))
        this.emitTelemetry()
        break
    }
  }

  private attemptReconnect(delayMs: number = 3000) {
    if (this.userStopped || !this.currentConfig || !this.currentSettings) return
    if (this.currentConfig.mode !== 'listener') {
      this.updateStatus('RECONNECTING', `Koneksi SRT terputus. Mencoba reconnect otomatis dalam ${Math.round(delayMs / 1000)} detik...`)
    }
    
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      if (!this.userStopped && this.currentPlaylist.length > 0 && this.currentConfig && this.currentSettings) {
        this.startBroadcast(this.currentPlaylist, this.currentConfig, this.currentSettings, this.currentIdx)
      }
    }, delayMs)
  }

  public updatePlaylist(playlist: PlaylistItem[], currentIdx: number) {
    this.currentPlaylist = playlist
    this.currentIdx = currentIdx
    if (playlist[currentIdx]) {
      this.currentClip = playlist[currentIdx].fileName
      this.telemetry.currentClip = this.currentClip
      this.emitTelemetry()
    }
  }

  public stopBroadcast(): { success: boolean } {
    this.userStopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.process) {
      try {
        // Send 'q' to FFmpeg for clean shutdown
        this.process.stdin?.write('q\n')
      } catch (e) {
        // Ignore
      }

      setTimeout(() => {
        if (this.process) {
          try {
            this.process.kill('SIGKILL')
          } catch (e) {
            // Ignore
          }
          this.process = null
        }
      }, 500)
    }

    this.cleanupTempFile()
    this.startTime = 0
    this.telemetry.bitrateKbps = 0
    this.telemetry.fps = 0
    this.telemetry.speed = '0x'
    this.telemetry.uptime = 0
    this.updateStatus('IDLE')
    return { success: true }
  }

  private cleanupTempFile() {
    if (this.tempPlaylistPath && fs.existsSync(this.tempPlaylistPath)) {
      try {
        fs.unlinkSync(this.tempPlaylistPath)
      } catch (err) {
        // Ignore
      }
      this.tempPlaylistPath = null
    }
  }
}

