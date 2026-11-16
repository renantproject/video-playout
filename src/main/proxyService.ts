import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { getBinPath } from './ffmpegUtils'
import { logger } from './logger'

let cacheDir: string | null = null

export function getCacheDir(): string {
  if (!cacheDir) {
    try {
      cacheDir = path.join(app.getPath('userData'), 'preview_proxies')
    } catch {
      cacheDir = path.join(os.tmpdir(), 'playout_preview_proxies')
    }
  }
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

// Set of video codecs that Chromium CANNOT natively decode
const NON_NATIVE_VIDEO_CODECS = new Set([
  'hq_hqa',      // Grass Valley / Canopus HQ / HQA
  'cuvc',        // Canopus HQ tag
  'prores',      // Apple ProRes
  'dnxhd',       // Avid DNxHD
  'dnxhr',       // Avid DNxHR
  'mpeg2video',  // MPEG-2 Broadcast Video
  'mjpeg',       // Motion JPEG
  'dvvideo',     // DVCPRO / DV
  'rawvideo',    // Raw uncompressed video
  'v210',        // 10-bit uncompressed
  'hevc',        // H.265 / HEVC
  'h265'
])

// Non-native broadcast container extensions
const NON_NATIVE_CONTAINERS = new Set([
  '.mxf',
  '.mts',
  '.m2ts',
  '.vob',
  '.dvd',
  '.gxf',
  '.ts',
  '.mpg',
  '.mpeg'
])

// In-memory cache mapping filePath -> boolean whether proxy is required
const proxyRequirementCache = new Map<string, boolean>()

// Register detected codec for a file path
export function registerMediaCodec(filePath: string, codecName?: string): boolean {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()

  if (NON_NATIVE_CONTAINERS.has(ext)) {
    proxyRequirementCache.set(filePath, true)
    return true
  }

  if (codecName) {
    const lower = codecName.toLowerCase()
    if (
      NON_NATIVE_VIDEO_CODECS.has(lower) ||
      lower.includes('prores') ||
      lower.includes('dnx') ||
      lower.includes('hq')
    ) {
      proxyRequirementCache.set(filePath, true)
      return true
    }
  }

  // Check if proxy already exists on disk
  if (isProxyReady(filePath)) {
    proxyRequirementCache.set(filePath, true)
    return true
  }

  proxyRequirementCache.set(filePath, false)
  return false
}

// Check if a media file needs an H.264 preview proxy
export function needsProxy(filePath: string, codecName?: string): boolean {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()

  if (NON_NATIVE_CONTAINERS.has(ext)) return true

  if (codecName) {
    return registerMediaCodec(filePath, codecName)
  }

  if (proxyRequirementCache.has(filePath)) {
    return proxyRequirementCache.get(filePath)!
  }

  // If proxy already exists on disk, it needs proxy
  const proxyPath = getProxyPath(filePath)
  if (fs.existsSync(proxyPath)) {
    try {
      if (fs.statSync(proxyPath).size > 1024) {
        proxyRequirementCache.set(filePath, true)
        return true
      }
    } catch {}
  }

  return false
}

// Generate deterministic cache file path
export function getProxyPath(filePath: string): string {
  const dir = getCacheDir()
  try {
    const stat = fs.statSync(filePath)
    const hash = crypto.createHash('md5').update(`${filePath}_${stat.size}_${stat.mtimeMs}`).digest('hex')
    return path.join(dir, `${hash}.mp4`)
  } catch {
    const hash = crypto.createHash('md5').update(filePath).digest('hex')
    return path.join(dir, `${hash}.mp4`)
  }
}

// Check if proxy already exists and has valid size
export function isProxyReady(filePath: string): boolean {
  const proxyPath = getProxyPath(filePath)
  try {
    return fs.existsSync(proxyPath) && fs.statSync(proxyPath).size > 1024
  } catch {
    return false
  }
}

export function getPlayablePath(filePath: string): string {
  if (needsProxy(filePath) && isProxyReady(filePath)) {
    return getProxyPath(filePath)
  }
  return filePath
}

// Broadcast progress to all windows
function broadcastProgress(filePath: string, progress: number, status: 'processing' | 'ready' | 'error') {
  const allWindows = BrowserWindow.getAllWindows()
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('proxy:progress', { filePath, progress, status })
    }
  }
}

function broadcastQueueStatus() {
  const allWindows = BrowserWindow.getAllWindows()
  const status = {
    total: proxyQueueManager.getTotalCount(),
    pending: proxyQueueManager.getPendingCount(),
    active: proxyQueueManager.getActiveCount(),
    completed: proxyQueueManager.getCompletedCount(),
    currentFile: proxyQueueManager.getCurrentFileName()
  }
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('proxy:queueStatus', status)
    }
  }
}

interface QueueItem {
  filePath: string
  priority: 'high' | 'normal'
  resolve: (proxyPath: string) => void
  reject: (err: any) => void
}

class ProxyQueueManager {
  private queue: QueueItem[] = []
  private activeJobs = new Map<string, Promise<string>>()
  private maxConcurrency = 1 // 1 concurrent job to protect CPU & network share bandwidth
  private currentRunning = 0
  private totalEnqueued = 0
  private completedCount = 0
  private currentFileName = ''

  public enqueue(filePath: string, priority: 'high' | 'normal' = 'normal'): Promise<string> {
    const proxyPath = getProxyPath(filePath)
    if (isProxyReady(filePath)) {
      broadcastProgress(filePath, 100, 'ready')
      return Promise.resolve(proxyPath)
    }

    // If already running, return existing promise
    const existing = this.activeJobs.get(filePath)
    if (existing) {
      return existing
    }

    // Check if already in pending queue
    const queuedIdx = this.queue.findIndex((q) => q.filePath === filePath)
    if (queuedIdx !== -1) {
      if (priority === 'high' && this.queue[queuedIdx].priority !== 'high') {
        // Elevate priority and move to front
        const [item] = this.queue.splice(queuedIdx, 1)
        item.priority = 'high'
        this.queue.unshift(item)
        logger.info('ProxyService', `Elevated "${path.basename(filePath)}" to high priority at front of queue`)
      }
      return new Promise<string>((resolve, reject) => {
        const item = this.queue.find((q) => q.filePath === filePath)
        if (item) {
          const prevResolve = item.resolve
          const prevReject = item.reject
          item.resolve = (p) => { prevResolve(p); resolve(p) }
          item.reject = (e) => { prevReject(e); reject(e) }
        } else {
          resolve(proxyPath)
        }
      })
    }

    this.totalEnqueued++

    return new Promise<string>((resolve, reject) => {
      const item: QueueItem = { filePath, priority, resolve, reject }
      if (priority === 'high') {
        this.queue.unshift(item)
        logger.info('ProxyService', `Enqueued HIGH priority proxy: "${path.basename(filePath)}"`)
      } else {
        this.queue.push(item)
        logger.info('ProxyService', `Enqueued background proxy: "${path.basename(filePath)}" (Queue position: ${this.queue.length})`)
      }
      broadcastQueueStatus()
      this.processNext()
    })
  }

  public enqueueBatch(filePaths: string[]) {
    for (const fp of filePaths) {
      if (needsProxy(fp) && !isProxyReady(fp)) {
        this.enqueue(fp, 'normal').catch((err) => {
          logger.warn('ProxyService', `Background batch proxy failed for ${path.basename(fp)}: ${err.message}`)
        })
      }
    }
  }

  private async processNext() {
    if (this.currentRunning >= this.maxConcurrency || this.queue.length === 0) {
      return
    }

    const nextItem = this.queue.shift()
    if (!nextItem) return

    const { filePath, resolve, reject } = nextItem
    const proxyPath = getProxyPath(filePath)

    if (isProxyReady(filePath)) {
      this.completedCount++
      broadcastProgress(filePath, 100, 'ready')
      broadcastQueueStatus()
      resolve(proxyPath)
      this.processNext()
      return
    }

    this.currentRunning++
    this.currentFileName = path.basename(filePath)
    broadcastQueueStatus()

    const jobPromise = this.transcodeFile(filePath)
    this.activeJobs.set(filePath, jobPromise)

    try {
      const resultPath = await jobPromise
      this.completedCount++
      broadcastProgress(filePath, 100, 'ready')
      resolve(resultPath)
    } catch (err: any) {
      broadcastProgress(filePath, 0, 'error')
      reject(err)
    } finally {
      this.activeJobs.delete(filePath)
      this.currentRunning--
      this.currentFileName = ''
      broadcastQueueStatus()
      // Continue next queued item
      setImmediate(() => this.processNext())
    }
  }

  private transcodeFile(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const proxyPath = getProxyPath(filePath)
      const tempPath = path.join(getCacheDir(), `tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`)
      const ffmpegExe = getBinPath('ffmpeg')
      const fileName = path.basename(filePath)

      broadcastProgress(filePath, 0, 'processing')
      logger.info('ProxyService', `[START] Generating preview proxy for: "${fileName}"`)
      const startTime = Date.now()

      // 720p ultrafast H.264 + fastdecode + stereo AAC 48k + faststart
      const args = [
        '-y',
        '-i', filePath,
        '-vf', 'scale=-2:720',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'fastdecode',
        '-g', '25',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        '-dn',
        '-sn',
        '-movflags', '+faststart',
        tempPath
      ]

      const proc = spawn(ffmpegExe, args)

      let stderrBuffer = ''
      let lastReportedPct = -1

      proc.stderr?.on('data', (chunk) => {
        stderrBuffer += chunk.toString()
        const timeMatch = stderrBuffer.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (timeMatch) {
          const secs = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3])
          // Approx percentage (cap at 95% until complete)
          const pct = Math.min(95, Math.max(1, Math.round((secs / 60) * 100)))
          if (pct >= lastReportedPct + 10) {
            lastReportedPct = pct
            broadcastProgress(filePath, pct, 'processing')
          }
        }
      })

      proc.on('error', (err) => {
        logger.error('ProxyService', `FFmpeg spawn error for "${fileName}"`, err)
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath) } catch {}
        }
        reject(err)
      })

      proc.on('close', (code) => {
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
        if (code === 0 && fs.existsSync(tempPath)) {
          try {
            if (fs.existsSync(proxyPath)) {
              try { fs.unlinkSync(proxyPath) } catch {}
            }
            fs.renameSync(tempPath, proxyPath)
            const stat = fs.statSync(proxyPath)
            const mb = (stat.size / 1048576).toFixed(1)
            logger.info('ProxyService', `[SUCCESS] Proxy generated for "${fileName}" in ${durationSec}s (${mb} MB) -> ${proxyPath}`)
            proxyRequirementCache.set(filePath, true)
            resolve(proxyPath)
          } catch (e: any) {
            logger.error('ProxyService', `Failed to rename temp proxy for "${fileName}"`, e)
            reject(e)
          }
        } else {
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath) } catch {}
          }
          logger.error('ProxyService', `[FAILED] Proxy transcode failed for "${fileName}" with exit code ${code}. Stderr snippet: ${stderrBuffer.slice(-300)}`)
          reject(new Error(`FFmpeg proxy transcode failed with code ${code}`))
        }
      })
    })
  }

  public getTotalCount() { return this.totalEnqueued }
  public getPendingCount() { return this.queue.length }
  public getActiveCount() { return this.currentRunning }
  public getCompletedCount() { return this.completedCount }
  public getCurrentFileName() { return this.currentFileName }
}

export const proxyQueueManager = new ProxyQueueManager()

// Exported standard ensureProxy function (uses the queue manager)
export function ensureProxy(filePath: string, priority: 'high' | 'normal' = 'normal'): Promise<string> {
  return proxyQueueManager.enqueue(filePath, priority)
}

export function queueBatchProxies(filePaths: string[]) {
  proxyQueueManager.enqueueBatch(filePaths)
}
