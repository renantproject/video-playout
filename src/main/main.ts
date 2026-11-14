import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Readable } from 'stream'
import { FfmpegManager } from './ffmpegManager'
import { extractMetadata } from './metadataService'
import { needsProxy, isProxyReady, ensureProxy, getProxyPath } from './proxyService'
import { PlaylistItem, SrtConfig, EncodingSettings } from '../types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Disable restrictive autoplay policy so local video preview can play instantly
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// Register privileged scheme for local media playback with byte-range streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-file',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let secondaryWindow: BrowserWindow | null = null
let ffmpegManager: FfmpegManager | null = null

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.mp4': return 'video/mp4'
    case '.mov': return 'video/quicktime'
    case '.mkv': return 'video/x-matroska'
    case '.avi': return 'video/x-msvideo'
    case '.ts': return 'video/mp2t'
    case '.webm': return 'video/webm'
    case '.mxf': return 'video/mp4' // Handled via H.264 MP4 proxy
    default: return 'application/octet-stream'
  }
}

function resolveFilePathFromUrl(url: string): string {
  // 1. Try fileURLToPath first
  try {
    const fileUrl = url.replace(/^media-file:\/\//, 'file://')
    const parsed = fileURLToPath(fileUrl)
    if (fs.existsSync(parsed)) return parsed
  } catch (e) {
    // Continue fallback
  }

  // 2. Decode raw path from custom URL
  let raw = decodeURIComponent(url.replace(/^media-file:\/\/\/?/, ''))

  if (process.platform === 'win32') {
    // Handle leading slash e.g. /C:/path -> C:/path
    if (/^\/[a-zA-Z]:/.test(raw)) {
      raw = raw.substring(1)
    } else if (/^[a-zA-Z]\//.test(raw)) {
      // In case Chromium stripped colon from drive letter: e.g. C/path -> C:/path
      raw = raw[0] + ':/' + raw.substring(2)
    }
  }

  return raw
}

function setupMediaProtocol() {
  protocol.handle('media-file', async (request) => {
    try {
      const originalFilePath = resolveFilePathFromUrl(request.url)
      let filePath = originalFilePath

      if (!fs.existsSync(originalFilePath)) {
        console.error('[Media Protocol] File not found:', originalFilePath, 'from request URL:', request.url)
        return new Response('File not found: ' + originalFilePath, { status: 404 })
      }

      // Check if file is non-native format (like MXF) that Chromium cannot demux/decode
      if (needsProxy(originalFilePath)) {
        if (!isProxyReady(originalFilePath)) {
          console.log('[Media Protocol] Waiting for preview proxy generation for:', originalFilePath)
          try {
            filePath = await ensureProxy(originalFilePath)
          } catch (e: any) {
            console.error('[Media Protocol] Failed to generate preview proxy:', e)
            return new Response('Gagal memproses preview MXF: ' + (e?.message || ''), { status: 500 })
          }
        } else {
          filePath = getProxyPath(originalFilePath)
        }
      }

      const stat = fs.statSync(filePath)
      const fileSize = stat.size
      const mimeType = getMimeType(filePath)
      const range = request.headers.get('Range')

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = end - start + 1

        const nodeStream = fs.createReadStream(filePath, { start, end })
        const webStream = (Readable as any).toWeb ? (Readable as any).toWeb(nodeStream) : (nodeStream as any)

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Range, Content-Type',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
          }
        })
      } else {
        const nodeStream = fs.createReadStream(filePath)
        const webStream = (Readable as any).toWeb ? (Readable as any).toWeb(nodeStream) : (nodeStream as any)

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Range, Content-Type',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
          }
        })
      }
    } catch (err: any) {
      console.error('[Media Protocol] Error:', err)
      return new Response('Internal error: ' + (err?.message || ''), { status: 500 })
    }
  })
}

function getPreloadPath(): string {
  const mjsPath = path.join(__dirname, 'preload.mjs')
  if (fs.existsSync(mjsPath)) return mjsPath
  const jsPath = path.join(__dirname, 'preload.js')
  if (fs.existsSync(jsPath)) return jsPath
  return path.join(__dirname, 'preload.cjs')
}

function createMainWindow() {
  const preloadPath = getPreloadPath()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0c0e14',
    title: 'PlayoutStream - Desktop Playout & SRT Broadcaster',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  // Initialize FFmpeg manager
  ffmpegManager = new FfmpegManager((telemetry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('broadcast:telemetry', telemetry)
    }
  })

  // Enable DevTools shortcut (F12 or Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
      secondaryWindow.close()
    }
    if (ffmpegManager) {
      ffmpegManager.stopBroadcast()
    }
  })
}

function createSecondaryWindow() {
  if (secondaryWindow) {
    if (secondaryWindow.isMinimized()) secondaryWindow.restore()
    secondaryWindow.focus()
    return
  }

  secondaryWindow = new BrowserWindow({
    width: 960,
    height: 540,
    backgroundColor: '#000000',
    title: 'PlayoutStream - Auxiliary Preview Output',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  const secondaryUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?mode=secondary`
    : `file://${path.join(__dirname, '../dist/index.html')}?mode=secondary`

  secondaryWindow.loadURL(secondaryUrl)

  secondaryWindow.on('closed', () => {
    secondaryWindow = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('secondary:closed')
    }
  })
}

app.whenReady().then(() => {
  setupMediaProtocol()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'ts', 'webm', 'm4v', 'mxf'] },
      { name: 'Broadcast MXF Files (*.mxf)', extensions: ['mxf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result.filePaths || []
})

ipcMain.handle('metadata:get', async (_event, filePath: string) => {
  return await extractMetadata(filePath)
})

ipcMain.handle('proxy:check', async (_event, filePath: string) => {
  return isProxyReady(filePath)
})

ipcMain.handle('proxy:generate', async (_event, filePath: string) => {
  return await ensureProxy(filePath)
})

ipcMain.handle('broadcast:start', async (_event, playlist: PlaylistItem[], config: SrtConfig, settings: EncodingSettings, currentIdx: number) => {
  if (!ffmpegManager) return { success: false, message: 'FFmpeg manager not initialized' }
  return await ffmpegManager.startBroadcast(playlist, config, settings, currentIdx)
})

ipcMain.handle('broadcast:stop', async () => {
  if (!ffmpegManager) return { success: false }
  return ffmpegManager.stopBroadcast()
})

ipcMain.handle('broadcast:updatePlaylist', async (_event, playlist: PlaylistItem[], currentIdx: number) => {
  if (ffmpegManager) {
    ffmpegManager.updatePlaylist(playlist, currentIdx)
  }
})

ipcMain.handle('secondary:toggle', async () => {
  if (secondaryWindow) {
    secondaryWindow.close()
    secondaryWindow = null
    return false
  } else {
    createSecondaryWindow()
    return true
  }
})

ipcMain.on('secondary:sync', (_event, channel: string, data: any) => {
  if (secondaryWindow && !secondaryWindow.isDestroyed()) {
    secondaryWindow.webContents.send('sync:fromPrimary', channel, data)
  }
})

