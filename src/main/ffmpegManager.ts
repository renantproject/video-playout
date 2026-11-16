import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { PlaylistItem, SrtConfig, EncodingSettings, BroadcastTelemetry, BroadcastStatus } from '../types'
import { getBinPath } from './ffmpegUtils'
import { getPlayablePath } from './proxyService'
import { logger } from './logger'

export class FfmpegManager {
  private channelId: 'A' | 'B'
  private process: ChildProcess | null = null
  private status: BroadcastStatus = 'IDLE'
  private telemetryCallback: ((channel: 'A' | 'B', telemetry: BroadcastTelemetry) => void) | null = null
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

  constructor(channelId: 'A' | 'B', telemetryCallback: (channel: 'A' | 'B', telemetry: BroadcastTelemetry) => void) {
    this.channelId = channelId
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
      this.telemetryCallback(this.channelId, { ...this.telemetry })
    }
  }

  // Create concat playlist file
  private generateConcatPlaylist(items: PlaylistItem[], startIdx: number = 0): string {
    const tempDir = os.tmpdir()
    const playlistFile = path.join(tempDir, `playout_concat_${this.channelId}_${Date.now()}.txt`)
    
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

  public async switchMedia(clip: PlaylistItem): Promise<{ success: boolean; message?: string }> {
    if (!this.currentConfig || !this.currentSettings) {
      return { success: false, message: 'Broadcast belum dikonfigurasi' }
    }
    // Only switch if broadcast is active
    if (!this.process && this.status !== 'LIVE' && this.status !== 'LISTENING' && this.status !== 'CONNECTING') {
      return { success: true }
    }

    logger.info('FFmpegManager', `[CH ${this.channelId}] Switching stream to new media: ${clip.fileName}`)

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.process) {
      const oldProc = this.process
      this.process = null
      oldProc.removeAllListeners('close')
      oldProc.removeAllListeners('exit')
      try {
        oldProc.kill()
      } catch (e) {}
    }

    this.cleanupTempFile()
    this.currentPlaylist = [clip]
    this.currentClip = clip.fileName
    this.telemetry.currentClip = clip.fileName

    // Wait a brief 150ms moment for OS socket cleanup
    await new Promise((resolve) => setTimeout(resolve, 150))

    return await this.startBroadcast([clip], this.currentConfig, this.currentSettings, 0)
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
      const oldProc = this.process
      this.process = null
      try {
        oldProc.kill()
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, 150))
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
      // Determine input args: single active clip loops continuously, multiple uses concat
      const isSingleClip = playlist.length === 1
      const inputArgs: string[] = []

      if (isSingleClip) {
        const directPath = playlist[0].filePath
        inputArgs.push(
          '-stream_loop', '-1', // Loop active clip continuously until changed or stopped
          '-re',
          '-i', directPath
        )
      } else {
        this.tempPlaylistPath = this.generateConcatPlaylist(playlist, startIdx)
        inputArgs.push(
          '-re',
          '-f', 'concat',
          '-safe', '0',
          '-i', this.tempPlaylistPath
        )
      }

      // Scaling and standardization filter
      const [w, h] = (settings.resolution || '1920x1080').split('x')
      const targetWidth = parseInt(w) || 1920
      const targetHeight = parseInt(h) || 1080
      const fps = settings.fps || 25

      const videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p`

      // CBR vs VBR rate control (Default strict CBR for rock-solid broadcast)
      const isCBR = settings.rateControl !== 'VBR'
      const vBitrate = settings.videoBitrate || 25000 // Default 25 Mbps
      const aBitrate = settings.audioBitrate || 192
      const bufSize = vBitrate // 1-second VBV buffer for constant bitrate
      const gop = settings.gopSize || Math.round(fps * 2)

      // SRT Target URL with 64MB buffers, linger=0 for instant release, and unlimited bandwidth
      const latencyUs = (config.latency || 200) * 1000
      const srtParams = `latency=${latencyUs}&pkt_size=1316&sndbuf=67108864&rcvbuf=67108864&maxbw=0&linger=0`
      let srtUrl = `srt://${config.host || '127.0.0.1'}:${config.port || 9000}?mode=${config.mode}&transtype=live&${srtParams}`

      if (config.mode === 'listener') {
        srtUrl = `srt://0.0.0.0:${config.port || 9000}?mode=listener&transtype=live&${srtParams}`
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

      // Encoder selection
      let videoCodec = 'libx264'
      const videoArgs: string[] = []

      if (settings.hwaccel === 'nvenc') {
        videoCodec = 'h264_nvenc'
        videoArgs.push(
          '-c:v', videoCodec,
          '-preset', 'p2',
          '-tune', 'll',
          '-zerolatency', '1',
          '-delay', '0'
        )
        if (isCBR) {
          videoArgs.push(
            '-rc:v', 'cbr',
            '-cbr', '1',
            '-b:v', `${vBitrate}k`,
            '-minrate', `${vBitrate}k`,
            '-maxrate', `${vBitrate}k`,
            '-bufsize', `${bufSize}k`
          )
        } else {
          videoArgs.push(
            '-b:v', `${vBitrate}k`,
            '-maxrate', `${Math.round(vBitrate * 1.2)}k`,
            '-bufsize', `${vBitrate * 2}k`
          )
        }
      } else if (settings.hwaccel === 'qsv') {
        videoCodec = 'h264_qsv'
        videoArgs.push('-c:v', videoCodec, '-preset', 'veryfast')
        if (isCBR) {
          videoArgs.push(
            '-b:v', `${vBitrate}k`,
            '-minrate', `${vBitrate}k`,
            '-maxrate', `${vBitrate}k`,
            '-bufsize', `${bufSize}k`
          )
        }
      } else if (settings.hwaccel === 'amf') {
        videoCodec = 'h264_amf'
        videoArgs.push('-c:v', videoCodec, '-quality', 'speed')
        if (isCBR) {
          videoArgs.push(
            '-rc', 'cbr',
            '-b:v', `${vBitrate}k`,
            '-minrate', `${vBitrate}k`,
            '-maxrate', `${vBitrate}k`,
            '-bufsize', `${bufSize}k`
          )
        }
      } else {
        // Universal CPU libx264: Locked strict CBR with Zero Latency to eliminate frame drops & stutter
        videoCodec = 'libx264'
        videoArgs.push(
          '-c:v', videoCodec,
          '-preset', settings.preset || 'ultrafast',
          '-tune', 'zerolatency'
        )
        if (isCBR) {
          videoArgs.push(
            '-b:v', `${vBitrate}k`,
            '-minrate', `${vBitrate}k`,
            '-maxrate', `${vBitrate}k`,
            '-bufsize', `${bufSize}k`,
            '-nal-hrd', 'cbr',
            '-x264-params', 'nal-hrd=cbr:force-cfr=1'
          )
        } else {
          videoArgs.push(
            '-b:v', `${vBitrate}k`,
            '-maxrate', `${Math.round(vBitrate * 1.2)}k`,
            '-bufsize', `${vBitrate * 2}k`
          )
        }
      }

      videoArgs.push('-g', gop.toString())

      const args = [
        ...inputArgs,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-vf', videoFilter,
        ...videoArgs,
        '-c:a', 'aac',
        '-b:a', `${aBitrate}k`,
        '-ar', '48000',
        '-ac', '2',
        '-af', 'aresample=async=1:first_pts=0',
        '-streamid', '0:256',
        '-streamid', '1:257',
        '-muxdelay', '0',
        '-muxpreload', '0',
        '-f', 'mpegts',
        '-mpegts_flags', '+resend_headers+pat_pmt_at_frames',
        '-progress', 'pipe:1',
        '-stats_period', '0.5',
        srtUrl
      ]

      const ffmpegExe = getBinPath('ffmpeg')
      logger.info('FFmpegManager', `[CH ${this.channelId}] Spawning FFmpeg at ${ffmpegExe} with args: ${args.join(' ')}`)

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
          logger.event('FFmpegManager', `[CH ${this.channelId}] Broadcast is now LIVE on air!`)
        }

        // Parse possible SRT RTT or drop stats from stderr
        if (text.includes('rtt=')) {
          const match = text.match(/rtt=([\d.]+)/)
          if (match) this.telemetry.rttMs = parseFloat(match[1])
        }
      })

      const currentProc = this.process
      currentProc.on('error', (err) => {
        if (this.process !== currentProc) return
        logger.error('FFmpegManager', `[CH ${this.channelId}] FFmpeg process error:`, err)
        this.updateStatus('ERROR', err.message)
      })

      currentProc.on('close', (code) => {
        if (this.process !== currentProc) return
        logger.info('FFmpegManager', `[CH ${this.channelId}] FFmpeg process exited with code ${code}`)
        this.cleanupTempFile()
        this.process = null

        if (!this.userStopped) {
          if (this.currentConfig?.mode === 'listener') {
            logger.info('FFmpegManager', `[CH ${this.channelId}] Client disconnected in listener mode. Re-listening...`)
            this.updateStatus('LISTENING')
            this.attemptReconnect(1500)
          } else {
            if (code === 0) {
              this.updateStatus('IDLE')
            } else {
              logger.warn('FFmpegManager', `[CH ${this.channelId}] FFmpeg exited unexpectedly with error code ${code}`)
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
      const oldProc = this.process
      this.process = null
      oldProc.removeAllListeners('close')
      oldProc.removeAllListeners('exit')
      try {
        oldProc.kill()
      } catch (e) {}
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

