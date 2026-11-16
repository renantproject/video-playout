import fs from 'fs'
import path from 'path'
import { PlaylistItem, RundownProgram, RundownGroup } from '../types'
import { extractMetadata } from './metadataService'
import { logger } from './logger'

const SUPPORTED_VIDEO_EXTS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.ts',
  '.webm',
  '.m4v',
  '.mxf'
])

export async function scanRundownFolder(rootPath: string): Promise<RundownProgram | null> {
  try {
    if (!fs.existsSync(rootPath)) {
      console.warn('[RundownService] Path does not exist:', rootPath)
      return null
    }

    const stat = fs.statSync(rootPath)
    if (!stat.isDirectory()) {
      console.warn('[RundownService] Path is not a directory:', rootPath)
      return null
    }

    const programName = path.basename(rootPath)
    const entries = fs.readdirSync(rootPath, { withFileTypes: true })

    // Separate subdirectories and direct files in root
    const subDirNames = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)

    // Sort subdirectories naturally (e.g. HL, SEG 1, SEG 2, SEG 3, SEG 10)
    subDirNames.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )

    const rootVideoFiles = entries
      .filter((e) => e.isFile() && SUPPORTED_VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const groups: RundownGroup[] = []

    // 1. If root directory has standalone video files, put them in a root group
    if (rootVideoFiles.length > 0) {
      const rootItems: PlaylistItem[] = []
      for (const fileName of rootVideoFiles) {
        const fullPath = path.join(rootPath, fileName)
        const meta = await extractMetadata(fullPath)
        if (meta) {
          rootItems.push({ ...meta, groupName: 'MAIN / UMUM' })
        }
      }

      groups.push({
        id: 'group-root-main',
        name: 'MAIN / UMUM',
        folderPath: rootPath,
        items: rootItems
      })
    }

    // 2. Process each subfolder
    for (const subDirName of subDirNames) {
      const subDirPath = path.join(rootPath, subDirName)
      try {
        const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true })
        const videoFiles = subEntries
          .filter((e) => e.isFile() && SUPPORTED_VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

        const groupItems: PlaylistItem[] = []
        for (const vf of videoFiles) {
          const filePath = path.join(subDirPath, vf)
          const meta = await extractMetadata(filePath)
          if (meta) {
            groupItems.push({
              ...meta,
              groupName: subDirName
            })
          }
        }

        groups.push({
          id: `group-${subDirName}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: subDirName,
          folderPath: subDirPath,
          items: groupItems
        })
      } catch (subErr) {
        console.error(`[RundownService] Error reading subfolder "${subDirPath}":`, subErr)
      }
    }

    const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0)
    logger.info('RundownService', `Scanned rundown folder "${programName}": found ${totalItems} clips across ${groups.length} groups`)

    return {
      name: programName,
      rootPath,
      groups
    }
  } catch (err: any) {
    logger.error('RundownService', `Scan error for "${rootPath}":`, err)
    return null
  }
}
