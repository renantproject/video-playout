import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { getBinPath } from './ffmpegUtils'

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

// Check if a media file is non-native to Chromium <video>
export function needsProxy(filePath: string): boolean {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()
  // Broadcast containers and non-standard HTML5 formats
  const nonNativeExts = ['.mxf', '.mts', '.m2ts', '.vob', '.dvd', '.gxf']
  return nonNativeExts.includes(ext)
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
  if (!needsProxy(filePath)) return true
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

// Active jobs to avoid duplicate transcode processes
const activeJobs = new Map<string, Promise<string>>()

// Broadcast progress to all windows
function broadcastProgress(filePath: string, progress: number, status: 'processing' | 'ready' | 'error') {
  const allWindows = BrowserWindow.getAllWindows()
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('proxy:progress', { filePath, progress, status })
    }
  }
}

// Ensure a proxy is generated for non-native file
export function ensureProxy(filePath: string): Promise<string> {
  if (!needsProxy(filePath)) {
    return Promise.resolve(filePath)
  }

  const proxyPath = getProxyPath(filePath)
  if (isProxyReady(filePath)) {
    broadcastProgress(filePath, 100, 'ready')
    return Promise.resolve(proxyPath)
  }

  // If a transcode job is already running, reuse promise
  const existingJob = activeJobs.get(filePath)
  if (existingJob) {
    return existingJob
  }

  const job = new Promise<string>((resolve, reject) => {
    const tempPath = path.join(getCacheDir(), `tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`)
    const ffmpegExe = getBinPath('ffmpeg')

    broadcastProgress(filePath, 0, 'processing')

    // Ultrafast 720p H.264 + stereo AAC transcode (~10x real-time speed)
    const args = [
      '-y',
      '-i', filePath,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-ac', '2',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      tempPath
    ]

    console.log(`[ProxyService] Starting proxy creation for: ${filePath}`)
    const proc = spawn(ffmpegExe, args)

    let stderrBuffer = ''
    proc.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk.toString()
      // Estimate progress from time output if duration is known
      const timeMatch = stderrBuffer.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
      if (timeMatch) {
        const secs = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3])
        // Cap progress at 95% until complete
        const pct = Math.min(95, Math.round((secs / 60) * 100))
        broadcastProgress(filePath, pct, 'processing')
      }
    })

    proc.on('error', (err) => {
      console.error(`[ProxyService] FFmpeg spawn error for ${filePath}:`, err)
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath) } catch {}
      }
      broadcastProgress(filePath, 0, 'error')
      reject(err)
    })

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempPath)) {
        try {
          if (fs.existsSync(proxyPath)) {
            try { fs.unlinkSync(proxyPath) } catch {}
          }
          fs.renameSync(tempPath, proxyPath)
          console.log(`[ProxyService] Proxy created successfully: ${proxyPath}`)
          broadcastProgress(filePath, 100, 'ready')
          resolve(proxyPath)
        } catch (e) {
          console.error(`[ProxyService] Failed to rename temp proxy:`, e)
          reject(e)
        }
      } else {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath) } catch {}
        }
        console.error(`[ProxyService] FFmpeg transcode exited with code ${code}`)
        broadcastProgress(filePath, 0, 'error')
        reject(new Error(`FFmpeg proxy transcode failed with exit code ${code}`))
      }
    })
  }).finally(() => {
    activeJobs.delete(filePath)
  })

  activeJobs.set(filePath, job)
  return job
}

