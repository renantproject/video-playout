import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { PlaylistItem } from '../types'
import { getBinPath } from './ffmpegUtils'

// Format duration helper
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
}

// Parse framerate string like "60/1" or "30000/1001"
function parseFps(fpsStr?: string): number {
  if (!fpsStr) return 30
  if (fpsStr.includes('/')) {
    const [num, den] = fpsStr.split('/').map(Number)
    if (den && den > 0) {
      return Math.round((num / den) * 100) / 100
    }
  }
  const parsed = parseFloat(fpsStr)
  return isNaN(parsed) ? 30 : parsed
}

export async function extractMetadata(filePath: string): Promise<PlaylistItem | null> {
  return new Promise((resolve) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return resolve(null)
    }

    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')

    // Run ffprobe to get JSON metadata
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]

    const probe = spawn(getBinPath('ffprobe'), ffprobeArgs)
    let stdoutData = ''
    let stderrData = ''

    probe.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString()
    })

    probe.stderr.on('data', (chunk) => {
      stderrData += chunk.toString()
    })

    probe.on('error', (err) => {
      console.error('ffprobe error:', err)
      // Fallback basic item without ffprobe
      resolve({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        filePath,
        fileName,
        duration: 0,
        durationFormatted: '00:00:00',
        resolution: 'Unknown',
        width: 1920,
        height: 1080,
        fps: 30,
        fileSize: stat.size,
        format: ext
      })
    })

    probe.on('close', async (code) => {
      try {
        const metadata = JSON.parse(stdoutData)
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video')
        const durationSec = parseFloat(metadata.format?.duration || videoStream?.duration || '0')
        const width = videoStream?.width || 1920
        const height = videoStream?.height || 1080
        const fps = parseFps(videoStream?.avg_frame_rate || videoStream?.r_frame_rate)

        // Generate thumbnail
        const thumbnail = await generateThumbnail(filePath, durationSec)

        resolve({
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filePath,
          fileName,
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          resolution: `${width}x${height}`,
          width,
          height,
          fps,
          thumbnail,
          fileSize: stat.size,
          format: videoStream?.codec_name || ext
        })
      } catch (err) {
        console.error('Error parsing ffprobe output:', err)
        resolve({
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filePath,
          fileName,
          duration: 0,
          durationFormatted: '00:00:00',
          resolution: '1920x1080',
          width: 1920,
          height: 1080,
          fps: 30,
          fileSize: stat.size,
          format: ext
        })
      }
    })
  })
}

// Generate base64 thumbnail using ffmpeg
function generateThumbnail(filePath: string, duration: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    // Pick timestamp at 10% or 1s
    const seekTime = Math.min(Math.max(duration * 0.1, 0.5), 10)

    const ffmpegArgs = [
      '-ss', seekTime.toString(),
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=160:-1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ]

    const ffmpeg = spawn(getBinPath('ffmpeg'), ffmpegArgs)
    const buffers: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk) => {
      buffers.push(Buffer.from(chunk))
    })

    ffmpeg.on('error', () => resolve(undefined))

    ffmpeg.on('close', (code) => {
      if (code === 0 && buffers.length > 0) {
        const fullBuffer = Buffer.concat(buffers)
        const base64 = `data:image/jpeg;base64,${fullBuffer.toString('base64')}`
        resolve(base64)
      } else {
        resolve(undefined)
      }
    })
  })
}

