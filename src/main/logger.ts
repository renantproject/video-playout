import fs from 'fs'
import path from 'path'
import { app } from 'electron'

class ActivityLogger {
  private logPaths: string[] = []
  private isInitialized = false

  constructor() {
    this.initPaths()
  }

  private initPaths() {
    try {
      // 1. Primary log in workspace directory for easy inspection
      const workspaceLog = 'D:\\hakim\\PROJECT\\video-playout\\playout_activity.log'
      this.logPaths.push(workspaceLog)

      // 2. Secondary log in userData
      try {
        const userLogsDir = path.join(app.getPath('userData'), 'logs')
        if (!fs.existsSync(userLogsDir)) {
          fs.mkdirSync(userLogsDir, { recursive: true })
        }
        this.logPaths.push(path.join(userLogsDir, 'playout_activity.log'))
      } catch {
        // Ignored before app ready
      }

      this.isInitialized = true
    } catch (e) {
      console.error('Failed to initialize logger paths:', e)
    }
  }

  private formatTimestamp(): string {
    const d = new Date()
    const pad = (n: number, s = 2) => n.toString().padStart(s, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const mins = pad(d.getMinutes())
    const secs = pad(d.getSeconds())
    const ms = pad(d.getMilliseconds(), 3)
    return `${year}-${month}-${day} ${hours}:${mins}:${secs}.${ms}`
  }

  public log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'EVENT', moduleName: string, message: string, meta?: any) {
    if (!this.isInitialized) this.initPaths()

    const ts = this.formatTimestamp()
    let metaStr = ''
    if (meta !== undefined) {
      if (meta instanceof Error) {
        metaStr = `\n  Error: ${meta.message}\n  Stack: ${meta.stack}`
      } else if (typeof meta === 'object') {
        try {
          metaStr = ` ${JSON.stringify(meta)}`
        } catch {
          metaStr = ` [Object]`
        }
      } else {
        metaStr = ` ${meta}`
      }
    }

    const logLine = `[${ts}] [${level.padEnd(5)}] [${moduleName}] ${message}${metaStr}\n`

    // Output to stdout/stderr
    if (level === 'ERROR') {
      process.stderr.write(logLine)
    } else {
      process.stdout.write(logLine)
    }

    // Append to all registered log files
    for (const p of this.logPaths) {
      try {
        fs.appendFileSync(p, logLine, 'utf8')
      } catch (err) {
        // Fallback or ignore write errors
      }
    }
  }

  public info(moduleName: string, message: string, meta?: any) {
    this.log('INFO', moduleName, message, meta)
  }

  public warn(moduleName: string, message: string, meta?: any) {
    this.log('WARN', moduleName, message, meta)
  }

  public error(moduleName: string, message: string, meta?: any) {
    this.log('ERROR', moduleName, message, meta)
  }

  public event(moduleName: string, message: string, meta?: any) {
    this.log('EVENT', moduleName, message, meta)
  }

  public getPrimaryLogPath(): string {
    return this.logPaths[0] || 'playout_activity.log'
  }
}

export const logger = new ActivityLogger()
