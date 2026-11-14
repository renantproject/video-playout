import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

let cachedFfmpegPath: string | null = null
let cachedFfprobePath: string | null = null

export function getBinPath(binName: 'ffmpeg' | 'ffprobe'): string {
  if (binName === 'ffmpeg' && cachedFfmpegPath) return cachedFfmpegPath
  if (binName === 'ffprobe' && cachedFfprobePath) return cachedFfprobePath

  const exeName = process.platform === 'win32' ? `${binName}.exe` : binName

  // 1. Check if on current process.env.PATH
  try {
    const whichCmd = process.platform === 'win32' ? `where.exe ${exeName}` : `which ${binName}`
    const result = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
    const firstLine = result.split('\n')[0].trim()
    if (firstLine && fs.existsSync(firstLine)) {
      if (binName === 'ffmpeg') cachedFfmpegPath = firstLine
      else cachedFfprobePath = firstLine
      return firstLine
    }
  } catch (e) {
    // Continue fallback
  }

  // 2. Check WinGet Gyan FFmpeg directory on Windows
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')

    if (fs.existsSync(wingetPackages)) {
      try {
        const dirs = fs.readdirSync(wingetPackages)
        for (const dir of dirs) {
          if (dir.toLowerCase().includes('ffmpeg')) {
            const candidateRoot = path.join(wingetPackages, dir)
            // Look for bin or inner folders
            const searchDirs = [
              path.join(candidateRoot, 'bin'),
              candidateRoot
            ]

            // Check subdirectories inside candidateRoot (e.g. ffmpeg-9.0.2-full_build\bin)
            try {
              const subDirs = fs.readdirSync(candidateRoot)
              for (const sub of subDirs) {
                searchDirs.push(path.join(candidateRoot, sub, 'bin'))
              }
            } catch (err) {}

            for (const sDir of searchDirs) {
              const fullExe = path.join(sDir, exeName)
              if (fs.existsSync(fullExe)) {
                // Prepend to PATH so child processes also find it
                if (!process.env.PATH?.includes(sDir)) {
                  process.env.PATH = `${sDir};${process.env.PATH}`
                }
                if (binName === 'ffmpeg') cachedFfmpegPath = fullExe
                else cachedFfprobePath = fullExe
                return fullExe
              }
            }
          }
        }
      } catch (err) {
        // Ignore
      }
    }
  }

  // Fallback to bare command name
  return binName
}

