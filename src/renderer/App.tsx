import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from './components/Header'
import { ChannelPlayer } from './components/ChannelPlayer'
import { RundownQueue } from './components/RundownQueue'
import { SrtBroadcastPanel } from './components/SrtBroadcastPanel'
import { SettingsModal } from './components/SettingsModal'
import {
  PlaylistItem,
  RundownProgram,
  SrtConfig,
  EncodingSettings,
  BroadcastTelemetry
} from '../types'
import { HelpCircle, X, Keyboard } from 'lucide-react'

export const App: React.FC = () => {
  // Rundown & Playlist State
  const [rundown, setRundown] = useState<RundownProgram | null>(null)
  const [standalonePlaylist, setStandalonePlaylist] = useState<PlaylistItem[]>([])
  const [selectedClip, setSelectedClip] = useState<PlaylistItem | null>(null)
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false)

  // Channel A State (MAIN)
  const [currentItemA, setCurrentItemA] = useState<PlaylistItem | null>(null)
  const [isPlayingA, setIsPlayingA] = useState<boolean>(false)
  const [isLoopingA, setIsLoopingA] = useState<boolean>(false)
  const [currentTimeA, setCurrentTimeA] = useState<number>(0)
  const [durationA, setDurationA] = useState<number>(0)
  const [volumeA, setVolumeA] = useState<number>(0.85)
  const [isMutedA, setIsMutedA] = useState<boolean>(false)
  const [seekTargetA, setSeekTargetA] = useState<number | null>(null)
  const [stepFrameDeltaA, setStepFrameDeltaA] = useState<number | null>(null)

  // Channel B State (MAIN)
  const [currentItemB, setCurrentItemB] = useState<PlaylistItem | null>(null)
  const [isPlayingB, setIsPlayingB] = useState<boolean>(false)
  const [isLoopingB, setIsLoopingB] = useState<boolean>(false)
  const [currentTimeB, setCurrentTimeB] = useState<number>(0)
  const [durationB, setDurationB] = useState<number>(0)
  const [volumeB, setVolumeB] = useState<number>(0.85)
  const [isMutedB, setIsMutedB] = useState<boolean>(false)
  const [seekTargetB, setSeekTargetB] = useState<number | null>(null)
  const [stepFrameDeltaB, setStepFrameDeltaB] = useState<number | null>(null)

  // Dual SRT Broadcast State (Channel A: Port 9000, Channel B: Port 9001)
  const [srtConfigA, setSrtConfigA] = useState<SrtConfig>({
    mode: 'listener',
    host: '127.0.0.1',
    port: 9000,
    latency: 200,
  })

  const [srtConfigB, setSrtConfigB] = useState<SrtConfig>({
    mode: 'listener',
    host: '127.0.0.1',
    port: 9001,
    latency: 200,
  })

  const [encodingSettings, setEncodingSettings] = useState<EncodingSettings>({
    resolution: '1920x1080',
    fps: 25,
    videoBitrate: 25000, // 25 Mbps CBR - Siaran Full HD Broadcast
    audioBitrate: 192,
    preset: 'ultrafast',
    hwaccel: 'cpu',
    gopSize: 50,
    rateControl: 'CBR',
    tune: 'zerolatency'
  })

  const [proxyQueueStatus, setProxyQueueStatus] = useState<{
    total: number
    pending: number
    active: number
    completed: number
    currentFile: string
  } | null>(null)

  const [telemetryA, setTelemetryA] = useState<BroadcastTelemetry>({
    status: 'IDLE',
    bitrateKbps: 0,
    fps: 0,
    dropFrames: 0,
    rttMs: 0,
    bufferHealth: 100,
    speed: '0x',
    uptime: 0,
    currentClip: ''
  })

  const [telemetryB, setTelemetryB] = useState<BroadcastTelemetry>({
    status: 'IDLE',
    bitrateKbps: 0,
    fps: 0,
    dropFrames: 0,
    rttMs: 0,
    bufferHealth: 100,
    speed: '0x',
    uptime: 0,
    currentClip: ''
  })

  const isBroadcastingA =
    telemetryA.status === 'LIVE' ||
    telemetryA.status === 'CONNECTING' ||
    telemetryA.status === 'LISTENING' ||
    telemetryA.status === 'RECONNECTING'

  const isBroadcastingB =
    telemetryB.status === 'LIVE' ||
    telemetryB.status === 'CONNECTING' ||
    telemetryB.status === 'LISTENING' ||
    telemetryB.status === 'RECONNECTING'

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false)

  // References to latest state for global shortcuts
  const selectedClipRef = useRef(selectedClip)
  selectedClipRef.current = selectedClip

  const rundownRef = useRef(rundown)
  rundownRef.current = rundown

  const standaloneRef = useRef(standalonePlaylist)
  standaloneRef.current = standalonePlaylist

  const isPlayingARef = useRef(isPlayingA)
  isPlayingARef.current = isPlayingA

  const isPlayingBRef = useRef(isPlayingB)
  isPlayingBRef.current = isPlayingB

  const isLoopingARef = useRef(isLoopingA)
  isLoopingARef.current = isLoopingA

  const isLoopingBRef = useRef(isLoopingB)
  isLoopingBRef.current = isLoopingB

  const currentItemARef = useRef(currentItemA)
  currentItemARef.current = currentItemA

  const currentItemBRef = useRef(currentItemB)
  currentItemBRef.current = currentItemB

  const isBroadcastingARef = useRef(isBroadcastingA)
  isBroadcastingARef.current = isBroadcastingA

  const isBroadcastingBRef = useRef(isBroadcastingB)
  isBroadcastingBRef.current = isBroadcastingB

  // Helper to get all clips in rundown and standalone playlist in playback order
  const getAllOrderedClips = useCallback((): PlaylistItem[] => {
    const list: PlaylistItem[] = []
    if (rundownRef.current?.groups) {
      for (const group of rundownRef.current.groups) {
        for (const item of group.items) {
          list.push(item)
        }
      }
    }
    if (standaloneRef.current && standaloneRef.current.length > 0) {
      list.push(...standaloneRef.current)
    }
    return list
  }, [])

  // Helper to get first available clip if none is selected
  const getFirstAvailableClip = useCallback((): PlaylistItem | null => {
    if (selectedClipRef.current) return selectedClipRef.current
    const all = getAllOrderedClips()
    return all.length > 0 ? all[0] : null
  }, [getAllOrderedClips])

  // Subscribe to Telemetry and Proxy Progress
  useEffect(() => {
    if (window.electronAPI) {
      const cleanupTelemetry = window.electronAPI.onBroadcastTelemetry((data) => {
        if (data && 'channel' in data) {
          if (data.channel === 'A') {
            setTelemetryA(data.telemetry)
          } else if (data.channel === 'B') {
            setTelemetryB(data.telemetry)
          }
        }
      })

      const cleanupProxy = window.electronAPI.onProxyProgress?.((data) => {
        const updateItem = (item: PlaylistItem | null): PlaylistItem | null => {
          if (!item) return null
          if (item.filePath === data.filePath) {
            return {
              ...item,
              isProxyReady: data.status === 'ready',
              proxyProgress: data.progress
            }
          }
          return item
        }

        setCurrentItemA((prev) => updateItem(prev))
        setCurrentItemB((prev) => updateItem(prev))

        setRundown((prev) => {
          if (!prev) return null
          return {
            ...prev,
            groups: prev.groups.map((g) => ({
              ...g,
              items: g.items.map((it) => (it.filePath === data.filePath ? (updateItem(it) as PlaylistItem) : it))
            }))
          }
        })

        setStandalonePlaylist((prev) =>
          prev.map((it) => (it.filePath === data.filePath ? (updateItem(it) as PlaylistItem) : it))
        )
      })

      const cleanupQueue = window.electronAPI.onProxyQueueStatus?.((status) => {
        setProxyQueueStatus(status)
      })

      return () => {
        cleanupTelemetry()
        if (cleanupProxy) cleanupProxy()
        if (cleanupQueue) cleanupQueue()
      }
    }
  }, [])

  // Playback Handlers for Channel A
  const handlePlayA = useCallback(() => {
    if (!currentItemA) return
    setIsPlayingA(true)
  }, [currentItemA])

  const handleStopA = useCallback(() => {
    setIsPlayingA(false)
    setCurrentTimeA(0)
    setSeekTargetA(0)
  }, [])

  const handleTogglePlayStopA = useCallback(() => {
    if (isPlayingARef.current) {
      handleStopA()
    } else {
      handlePlayA()
    }
  }, [handleStopA, handlePlayA])

  const handleToggleLoopA = useCallback(() => {
    setIsLoopingA((prev) => !prev)
  }, [])

  const handleSeekA = useCallback((time: number) => {
    setCurrentTimeA(time)
    setSeekTargetA(time)
  }, [])

  const handleEndedA = useCallback(() => {
    if (isLoopingARef.current) {
      return
    }
    setIsPlayingA(false)
    setCurrentTimeA(0)
    setSeekTargetA(0)
  }, [])

  // Playback Handlers for Channel B
  const handlePlayB = useCallback(() => {
    if (!currentItemB) return
    setIsPlayingB(true)
  }, [currentItemB])

  const handleStopB = useCallback(() => {
    setIsPlayingB(false)
    setCurrentTimeB(0)
    setSeekTargetB(0)
  }, [])

  const handleTogglePlayStopB = useCallback(() => {
    if (isPlayingBRef.current) {
      handleStopB()
    } else {
      handlePlayB()
    }
  }, [handleStopB, handlePlayB])

  const handleToggleLoopB = useCallback(() => {
    setIsLoopingB((prev) => !prev)
  }, [])

  const handleSeekB = useCallback((time: number) => {
    setCurrentTimeB(time)
    setSeekTargetB(time)
  }, [])

  const handleEndedB = useCallback(() => {
    if (isLoopingBRef.current) {
      return
    }
    setIsPlayingB(false)
    setCurrentTimeB(0)
    setSeekTargetB(0)
  }, [])

  // Material Loading Handlers
  const handleLoadToChannelA = useCallback((clip: PlaylistItem) => {
    setCurrentItemA(clip)
    setCurrentTimeA(0)
    setSeekTargetA(0)
    setIsPlayingA(false)
    if (isBroadcastingARef.current) {
      window.electronAPI?.switchBroadcastMedia?.('A', clip)
    }
  }, [])

  const handleLoadToChannelB = useCallback((clip: PlaylistItem) => {
    setCurrentItemB(clip)
    setCurrentTimeB(0)
    setSeekTargetB(0)
    setIsPlayingB(false)
    if (isBroadcastingBRef.current) {
      window.electronAPI?.switchBroadcastMedia?.('B', clip)
    }
  }, [])

  const handlePullSelectedToChannelA = useCallback(() => {
    const clip = getFirstAvailableClip()
    if (clip) {
      handleLoadToChannelA(clip)
    }
  }, [getFirstAvailableClip, handleLoadToChannelA])

  const handlePullSelectedToChannelB = useCallback(() => {
    const clip = getFirstAvailableClip()
    if (clip) {
      handleLoadToChannelB(clip)
    }
  }, [getFirstAvailableClip, handleLoadToChannelB])

  // Next Item Smart Handlers (Skip items currently in the other channel)
  const handleNextItemA = useCallback(() => {
    const allClips = getAllOrderedClips()
    if (allClips.length === 0) return

    const pathA = currentItemARef.current?.filePath
    const pathB = currentItemBRef.current?.filePath

    let startIdx = -1
    if (pathA) {
      startIdx = allClips.findIndex((c) => c.filePath === pathA)
    }

    const startIndexToSearch = startIdx === -1 ? 0 : (startIdx + 1) % allClips.length

    for (let i = 0; i < allClips.length; i++) {
      const idx = (startIndexToSearch + i) % allClips.length
      const candidate = allClips[idx]

      // Rule: skip item already loaded in Channel B
      if (pathB && candidate.filePath === pathB) {
        continue
      }
      // If there are other items, do not reselect current item A
      if (pathA && candidate.filePath === pathA && allClips.length > 1) {
        continue
      }

      handleLoadToChannelA(candidate)
      setSelectedClip(candidate)
      break
    }
  }, [getAllOrderedClips, handleLoadToChannelA])

  const handleNextItemB = useCallback(() => {
    const allClips = getAllOrderedClips()
    if (allClips.length === 0) return

    const pathA = currentItemARef.current?.filePath
    const pathB = currentItemBRef.current?.filePath

    let startIdx = -1
    if (pathB) {
      startIdx = allClips.findIndex((c) => c.filePath === pathB)
    }

    const startIndexToSearch = startIdx === -1 ? 0 : (startIdx + 1) % allClips.length

    for (let i = 0; i < allClips.length; i++) {
      const idx = (startIndexToSearch + i) % allClips.length
      const candidate = allClips[idx]

      // Rule: skip item already loaded in Channel A
      if (pathA && candidate.filePath === pathA) {
        continue
      }
      // If there are other items, do not reselect current item B
      if (pathB && candidate.filePath === pathB && allClips.length > 1) {
        continue
      }

      handleLoadToChannelB(candidate)
      setSelectedClip(candidate)
      break
    }
  }, [getAllOrderedClips, handleLoadToChannelB])

  // Handle direct file picking or dropping on Channel slot
  const handlePickFileA = useCallback(async () => {
    if (!window.electronAPI?.openFileDialog) return
    const files = await window.electronAPI.openFileDialog()
    if (files && files.length > 0) {
      const meta = await window.electronAPI.getVideoMetadata(files[0])
      if (meta) handleLoadToChannelA(meta)
    }
  }, [handleLoadToChannelA])

  const handlePickFileB = useCallback(async () => {
    if (!window.electronAPI?.openFileDialog) return
    const files = await window.electronAPI.openFileDialog()
    if (files && files.length > 0) {
      const meta = await window.electronAPI.getVideoMetadata(files[0])
      if (meta) handleLoadToChannelB(meta)
    }
  }, [handleLoadToChannelB])

  const handleDropItemA = useCallback(
    async (item: PlaylistItem | string) => {
      if (typeof item === 'object') {
        handleLoadToChannelA(item)
      } else if (typeof item === 'string' && window.electronAPI) {
        const meta = await window.electronAPI.getVideoMetadata(item)
        if (meta) handleLoadToChannelA(meta)
      }
    },
    [handleLoadToChannelA]
  )

  const handleDropItemB = useCallback(
    async (item: PlaylistItem | string) => {
      if (typeof item === 'object') {
        handleLoadToChannelB(item)
      } else if (typeof item === 'string' && window.electronAPI) {
        const meta = await window.electronAPI.getVideoMetadata(item)
        if (meta) handleLoadToChannelB(meta)
      }
    },
    [handleLoadToChannelB]
  )

  // Open Folder & Rundown Handlers
  const handleOpenFolder = useCallback(async () => {
    if (!window.electronAPI?.openFolderDialog) return
    setIsLoadingFolder(true)
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (result) {
        setRundown(result)
        for (const g of result.groups) {
          if (g.items.length > 0) {
            setSelectedClip(g.items[0])
            break
          }
        }
      }
    } catch (e) {
      console.error('Error opening folder rundown:', e)
    } finally {
      setIsLoadingFolder(false)
    }
  }, [])

  const handleRefreshRundown = useCallback(async () => {
    if (!rundown?.rootPath || !window.electronAPI?.scanRundownFolder) return
    setIsLoadingFolder(true)
    try {
      const refreshed = await window.electronAPI.scanRundownFolder(rundown.rootPath)
      if (refreshed) {
        setRundown(refreshed)
      }
    } catch (e) {
      console.error('Error refreshing rundown:', e)
    } finally {
      setIsLoadingFolder(false)
    }
  }, [rundown?.rootPath])

  const handleAddFiles = useCallback(async () => {
    if (!window.electronAPI?.openFileDialog) return
    const files = await window.electronAPI.openFileDialog()
    if (files && files.length > 0) {
      const newItems: PlaylistItem[] = []
      for (const p of files) {
        try {
          const meta = await window.electronAPI.getVideoMetadata(p)
          if (meta) newItems.push(meta)
        } catch (err) {
          console.error('Error extracting video metadata for:', p, err)
        }
      }
      if (newItems.length > 0) {
        setStandalonePlaylist((prev) => [...prev, ...newItems])
        if (!selectedClip) {
          setSelectedClip(newItems[0])
        }
      }
    }
  }, [selectedClip])

  const handleDropFiles = useCallback(
    async (files: FileList | string[]) => {
      const paths: string[] = []
      if (files instanceof FileList) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const fPath = (file as any).path
          if (fPath) paths.push(fPath)
        }
      } else if (Array.isArray(files)) {
        paths.push(...files)
      }

      if (paths.length > 0 && window.electronAPI) {
        const newItems: PlaylistItem[] = []
        for (const p of paths) {
          try {
            const meta = await window.electronAPI.getVideoMetadata(p)
            if (meta) newItems.push(meta)
          } catch (err) {
            console.error('Error on dropped video:', err)
          }
        }
        if (newItems.length > 0) {
          setStandalonePlaylist((prev) => [...prev, ...newItems])
          if (!selectedClip) {
            setSelectedClip(newItems[0])
          }
        }
      }
    },
    [selectedClip]
  )

  const handleClearAll = useCallback(() => {
    handleStopA()
    handleStopB()
    setRundown(null)
    setStandalonePlaylist([])
    setSelectedClip(null)
    setCurrentItemA(null)
    setCurrentItemB(null)
    if (isBroadcastingA || isBroadcastingB) {
      window.electronAPI?.stopBroadcast()
    }
  }, [handleStopA, handleStopB, isBroadcastingA, isBroadcastingB])

  // Keyboard Shortcuts (F1 to F8)
  const processShortcut = useCallback(
    (key: string) => {
      switch (key) {
        case 'F1':
          handlePullSelectedToChannelA()
          break
        case 'F2':
          handleNextItemA()
          break
        case 'F3':
          handleTogglePlayStopA()
          break
        case 'F4':
          handleToggleLoopA()
          break
        case 'F5':
          handlePullSelectedToChannelB()
          break
        case 'F6':
          handleNextItemB()
          break
        case 'F7':
          handleTogglePlayStopB()
          break
        case 'F8':
          handleToggleLoopB()
          break
      }
    },
    [
      handlePullSelectedToChannelA,
      handleNextItemA,
      handleTogglePlayStopA,
      handleToggleLoopA,
      handlePullSelectedToChannelB,
      handleNextItemB,
      handleTogglePlayStopB,
      handleToggleLoopB
    ]
  )

  useEffect(() => {
    const cleanupGlobal = window.electronAPI?.onGlobalShortcut?.((key) => {
      processShortcut(key)
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'].includes(e.key)) {
        e.preventDefault()
        processShortcut(e.key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (cleanupGlobal) cleanupGlobal()
    }
  }, [processShortcut])

  // Dual SRT Broadcast Handlers (Simultaneous Streaming Channel A & Channel B)
  const handleStartBroadcastA = useCallback(async () => {
    if (!currentItemA) {
      alert('Pilih dan tarik video ke Channel A terlebih dahulu sebelum broadcast!')
      return
    }
    const res = await window.electronAPI.startBroadcast('A', [currentItemA], srtConfigA, encodingSettings, 0)
    if (!res.success) {
      alert(res.message || 'Gagal memulai broadcast SRT Channel A')
    }
  }, [currentItemA, srtConfigA, encodingSettings])

  const handleStopBroadcastA = useCallback(async () => {
    await window.electronAPI.stopBroadcast('A')
  }, [])

  const handleStartBroadcastB = useCallback(async () => {
    if (!currentItemB) {
      alert('Pilih dan tarik video ke Channel B terlebih dahulu sebelum broadcast!')
      return
    }
    const res = await window.electronAPI.startBroadcast('B', [currentItemB], srtConfigB, encodingSettings, 0)
    if (!res.success) {
      alert(res.message || 'Gagal memulai broadcast SRT Channel B')
    }
  }, [currentItemB, srtConfigB, encodingSettings])

  const handleStopBroadcastB = useCallback(async () => {
    await window.electronAPI.stopBroadcast('B')
  }, [])

  const handleStartAll = useCallback(async () => {
    if (!currentItemA && !currentItemB) {
      alert('Pilih dan tarik video ke Channel A atau Channel B terlebih dahulu!')
      return
    }
    if (currentItemA && !isBroadcastingA) {
      await handleStartBroadcastA()
    }
    if (currentItemB && !isBroadcastingB) {
      await handleStartBroadcastB()
    }
  }, [currentItemA, currentItemB, isBroadcastingA, isBroadcastingB, handleStartBroadcastA, handleStartBroadcastB])

  const handleStopAll = useCallback(async () => {
    await window.electronAPI.stopBroadcast()
  }, [])

  const handleOpenLog = useCallback(async () => {
    if (window.electronAPI?.openLogFile) {
      const res = await window.electronAPI.openLogFile()
      if (!res.success) {
        alert('File log belum tersedia: ' + (res.message || ''))
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0c12] text-gray-100 select-none overflow-hidden font-sans">
      {/* 1. Header (Clean & Minimalist with Dual SRT Status & Activity Log) */}
      <Header
        broadcastStatusA={telemetryA.status}
        broadcastStatusB={telemetryB.status}
        portA={srtConfigA.port}
        portB={srtConfigB.port}
        proxyQueueStatus={proxyQueueStatus || undefined}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenLog={handleOpenLog}
      />

      {/* 2. Main Workspace: Left (Dual Channel A & B) + Right (Rundown & Queue) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Dual Channel Playout Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#080a0f] p-2 space-y-2 overflow-y-auto">
          {/* Dual Channel Split View: Channel A (Left) and Channel B (Right) */}
          <div className="flex-1 flex gap-2 min-h-0">
            {/* Channel A (MAIN) */}
            <ChannelPlayer
              channelId="A"
              channelTitle="CHANNEL A"
              themeColor="blue"
              currentItem={currentItemA}
              isPlaying={isPlayingA}
              isLooping={isLoopingA}
              currentTime={currentTimeA}
              duration={durationA}
              volume={volumeA}
              isMuted={isMutedA}
              seekTarget={seekTargetA}
              stepFrameDelta={stepFrameDeltaA}
              isLiveOnAir={isBroadcastingA}
              onPlay={handlePlayA}
              onStop={handleStopA}
              onNextItem={handleNextItemA}
              onToggleLoop={handleToggleLoopA}
              onSeek={handleSeekA}
              onTimeUpdate={(t, d) => {
                setCurrentTimeA(t)
                setDurationA(d)
              }}
              onDurationChange={(d) => setDurationA(d)}
              onEnded={handleEndedA}
              onStepFrameHandled={() => setStepFrameDeltaA(null)}
              onVolumeChange={(v) => {
                setVolumeA(v)
                if (isMutedA && v > 0) setIsMutedA(false)
              }}
              onToggleMute={() => setIsMutedA(!isMutedA)}
              onClearItem={() => {
                handleStopA()
                setCurrentItemA(null)
              }}
              onDropItem={handleDropItemA}
              onPickFile={handlePickFileA}
            />

            {/* Channel B (MAIN) */}
            <ChannelPlayer
              channelId="B"
              channelTitle="CHANNEL B"
              themeColor="emerald"
              currentItem={currentItemB}
              isPlaying={isPlayingB}
              isLooping={isLoopingB}
              currentTime={currentTimeB}
              duration={durationB}
              volume={volumeB}
              isMuted={isMutedB}
              seekTarget={seekTargetB}
              stepFrameDelta={stepFrameDeltaB}
              isLiveOnAir={isBroadcastingB}
              onPlay={handlePlayB}
              onStop={handleStopB}
              onNextItem={handleNextItemB}
              onToggleLoop={handleToggleLoopB}
              onSeek={handleSeekB}
              onTimeUpdate={(t, d) => {
                setCurrentTimeB(t)
                setDurationB(d)
              }}
              onDurationChange={(d) => setDurationB(d)}
              onEnded={handleEndedB}
              onStepFrameHandled={() => setStepFrameDeltaB(null)}
              onVolumeChange={(v) => {
                setVolumeB(v)
                if (isMutedB && v > 0) setIsMutedB(false)
              }}
              onToggleMute={() => setIsMutedB(!isMutedB)}
              onClearItem={() => {
                handleStopB()
                setCurrentItemB(null)
              }}
              onDropItem={handleDropItemB}
              onPickFile={handlePickFileB}
            />
          </div>
        </div>

        {/* Right Column: Rundown & Queue Panel */}
        <RundownQueue
          rundown={rundown}
          standalonePlaylist={standalonePlaylist}
          selectedClip={selectedClip}
          channelAItem={currentItemA}
          channelBItem={currentItemB}
          onSelectClip={(clip) => setSelectedClip(clip)}
          onLoadToChannelA={handleLoadToChannelA}
          onLoadToChannelB={handleLoadToChannelB}
          onOpenFolder={handleOpenFolder}
          onAddFiles={handleAddFiles}
          onRefreshRundown={handleRefreshRundown}
          onClearAll={handleClearAll}
          onDropFiles={handleDropFiles}
          isLoadingFolder={isLoadingFolder}
        />
      </div>

      {/* 3. Bottom Dual SRT Broadcast Panel (Simultaneous Channel A & Channel B streaming) */}
      <SrtBroadcastPanel
        configA={srtConfigA}
        configB={srtConfigB}
        telemetryA={telemetryA}
        telemetryB={telemetryB}
        onStartBroadcastA={handleStartBroadcastA}
        onStopBroadcastA={handleStopBroadcastA}
        isBroadcastingA={isBroadcastingA}
        onStartBroadcastB={handleStartBroadcastB}
        onStopBroadcastB={handleStopBroadcastB}
        isBroadcastingB={isBroadcastingB}
        onStartAll={handleStartAll}
        onStopAll={handleStopAll}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 4. Settings Modal (Configures Port & Parameters for Channel A and Channel B) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        srtConfigA={srtConfigA}
        onSaveSrtConfigA={(newCfg) => setSrtConfigA(newCfg)}
        srtConfigB={srtConfigB}
        onSaveSrtConfigB={(newCfg) => setSrtConfigB(newCfg)}
        encodingSettings={encodingSettings}
        onSaveEncodingSettings={(newEnc) => setEncodingSettings(newEnc)}
        isBroadcastingA={isBroadcastingA}
        isBroadcastingB={isBroadcastingB}
      />

      {/* 5. Help & Shortcut Guide Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151924] border border-[#262f47] rounded-xl w-full max-w-md shadow-2xl p-5 text-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#262f47]">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                  Panduan Shortcut Keyboard
                </h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#202738]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-[#11141e] p-3 rounded border border-[#23293d]">
                <div>
                  <span className="text-blue-400 font-bold">F1:</span> Tarik Video ke CH A
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">F5:</span> Tarik Video ke CH B
                </div>
                <div>
                  <span className="text-blue-400 font-bold">F2:</span> Next Item CH A
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">F6:</span> Next Item CH B
                </div>
                <div>
                  <span className="text-blue-400 font-bold">F3:</span> Play / Stop CH A
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">F7:</span> Play / Stop CH B
                </div>
                <div>
                  <span className="text-amber-400 font-bold">F4:</span> Toggle Loop CH A
                </div>
                <div>
                  <span className="text-amber-400 font-bold">F8:</span> Toggle Loop CH B
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#262f47] text-right">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
