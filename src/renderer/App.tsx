import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from './components/Header'
import { VideoPlayer } from './components/VideoPlayer'
import { PlaybackControls } from './components/PlaybackControls'
import { PlaylistQueue } from './components/PlaylistQueue'
import { SrtBroadcastPanel } from './components/SrtBroadcastPanel'
import { SettingsModal } from './components/SettingsModal'
import {
  PlaylistItem,
  PlaybackMode,
  SrtConfig,
  EncodingSettings,
  BroadcastTelemetry
} from '../types'
import { HelpCircle, X, Keyboard, Radio, Tv } from 'lucide-react'

export const App: React.FC = () => {
  // Playlist State
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sequential')

  // Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [volume, setVolume] = useState<number>(0.8)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [seekTarget, setSeekTarget] = useState<number | null>(null)
  const [stepFrameDelta, setStepFrameDelta] = useState<number | null>(null)

  // SRT Broadcast State
  const [srtConfig, setSrtConfig] = useState<SrtConfig>({
    mode: 'caller',
    host: '127.0.0.1',
    port: 9000,
    latency: 200,
  })

  const [encodingSettings, setEncodingSettings] = useState<EncodingSettings>({
    resolution: '1920x1080',
    fps: 60,
    videoBitrate: 4500,
    audioBitrate: 128,
    preset: 'veryfast',
    hwaccel: 'cpu',
    gopSize: 120
  })

  const [telemetry, setTelemetry] = useState<BroadcastTelemetry>({
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

  // Windows & Modals
  const [isSecondaryActive, setIsSecondaryActive] = useState<boolean>(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false)

  const currentItem = playlist[currentIndex] || null

  // Subscribe to Telemetry from Main Process
  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onBroadcastTelemetry((data) => {
        setTelemetry(data)
      })
      const cleanupSec = window.electronAPI.onSecondaryWindowClose(() => {
        setIsSecondaryActive(false)
      })
      return () => {
        cleanup()
        cleanupSec()
      }
    }
  }, [])

  // Sync with Secondary Window when current item changes
  useEffect(() => {
    if (window.electronAPI && isSecondaryActive) {
      window.electronAPI.sendToSecondaryWindow('sync:media', {
        filePath: currentItem?.filePath || '',
        fileName: currentItem?.fileName || ''
      })
    }
  }, [currentItem, isSecondaryActive])

  // Sync playback status with secondary window
  const syncPlaybackAction = useCallback((action: 'play' | 'pause' | 'seek' | 'syncTime', time?: number) => {
    if (window.electronAPI && isSecondaryActive) {
      window.electronAPI.sendToSecondaryWindow('sync:playback', {
        action,
        time: time ?? currentTime
      })
    }
  }, [isSecondaryActive, currentTime])

  // Playback Handlers
  const handlePlay = useCallback(() => {
    if (!currentItem) return
    setIsPlaying(true)
    syncPlaybackAction('play')
  }, [currentItem, syncPlaybackAction])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    syncPlaybackAction('pause')
  }, [syncPlaybackAction])

  const handleStop = useCallback(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setSeekTarget(0)
    syncPlaybackAction('pause')
    syncPlaybackAction('seek', 0)
  }, [syncPlaybackAction])

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time)
    setSeekTarget(time)
    syncPlaybackAction('seek', time)
  }, [syncPlaybackAction])

  const handleStepFrame = useCallback((delta: number) => {
    setIsPlaying(false)
    setStepFrameDelta(delta)
    syncPlaybackAction('pause')
  }, [syncPlaybackAction])

  const handleStepFrameHandled = useCallback(() => {
    setStepFrameDelta(null)
  }, [])

  // Clip transitions according to PRD FR-2.5
  const handleEnded = useCallback(() => {
    if (playbackMode === 'loop_item') {
      handleSeek(0)
      handlePlay()
      return
    }

    const nextIndex = currentIndex + 1

    if (nextIndex < playlist.length) {
      // Advance to next clip
      setCurrentIndex(nextIndex)
      setCurrentTime(0)
      setSeekTarget(0)

      if (playbackMode === 'manual_cue') {
        // FR-2.5: Selesai memutar satu klip, berhenti di frame pertama klip berikutnya (standby)
        setIsPlaying(false)
        syncPlaybackAction('pause')
        syncPlaybackAction('seek', 0)
      } else {
        // Sequential or Loop Playlist: continue playing
        setIsPlaying(true)
        syncPlaybackAction('play')
      }
    } else {
      // Reached end of playlist
      if (playbackMode === 'loop_playlist') {
        setCurrentIndex(0)
        setCurrentTime(0)
        setSeekTarget(0)
        setIsPlaying(true)
        syncPlaybackAction('play')
      } else {
        // Sequential mode ends
        setIsPlaying(false)
        syncPlaybackAction('pause')
      }
    }
  }, [playbackMode, currentIndex, playlist.length, handleSeek, handlePlay, syncPlaybackAction])

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setCurrentTime(0)
      setSeekTarget(0)
      syncPlaybackAction('seek', 0)
    }
  }, [currentIndex, syncPlaybackAction])

  const handleNext = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentTime(0)
      setSeekTarget(0)
      syncPlaybackAction('seek', 0)
    }
  }, [currentIndex, playlist.length, syncPlaybackAction])

  // File Handling
  const addFilesToPlaylist = useCallback(async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return

    const newItems: PlaylistItem[] = []
    for (const p of filePaths) {
      try {
        const meta = await window.electronAPI.getVideoMetadata(p)
        if (meta) {
          newItems.push(meta)
        }
      } catch (err) {
        console.error('Error extracting video metadata for:', p, err)
      }
    }

    if (newItems.length > 0) {
      setPlaylist((prev) => {
        const updated = [...prev, ...newItems]
        // If broadcast is running, notify backend of updated playlist
        if (telemetry.status === 'LIVE' || telemetry.status === 'CONNECTING') {
          window.electronAPI.updateBroadcastPlaylist(updated, currentIndex)
        }
        return updated
      })
    }
  }, [currentIndex, telemetry.status])

  const handleAddFiles = useCallback(async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFileDialog()
      if (files && files.length > 0) {
        addFilesToPlaylist(files)
      }
    }
  }, [addFilesToPlaylist])

  const handleDropFiles = useCallback((files: FileList | string[]) => {
    const paths: string[] = []
    if (files instanceof FileList) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // In Electron, File objects carry a path property
        const fPath = (file as any).path
        if (fPath) paths.push(fPath)
      }
    } else if (Array.isArray(files)) {
      paths.push(...files)
    }

    if (paths.length > 0) {
      addFilesToPlaylist(paths)
    }
  }, [addFilesToPlaylist])

  const handleClearPlaylist = useCallback(() => {
    handleStop()
    setPlaylist([])
    setCurrentIndex(0)
    if (telemetry.status === 'LIVE') {
      window.electronAPI.stopBroadcast()
    }
  }, [handleStop, telemetry.status])

  const handleRemoveItem = useCallback((index: number) => {
    setPlaylist((prev) => {
      const updated = prev.filter((_, idx) => idx !== index)
      if (index === currentIndex) {
        handleStop()
        if (updated.length > 0) {
          setCurrentIndex(Math.min(currentIndex, updated.length - 1))
        }
      } else if (index < currentIndex) {
        setCurrentIndex(currentIndex - 1)
      }
      return updated
    })
  }, [currentIndex, handleStop])

  const handleDuplicateItem = useCallback((index: number) => {
    setPlaylist((prev) => {
      const target = prev[index]
      if (!target) return prev
      const duplicated: PlaylistItem = {
        ...target,
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileName: `${target.fileName} (Copy)`
      }
      const updated = [...prev]
      updated.splice(index + 1, 0, duplicated)
      return updated
    })
  }, [])

  const handleMoveItem = useCallback((fromIndex: number, toIndex: number) => {
    setPlaylist((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)

      if (currentIndex === fromIndex) {
        setCurrentIndex(toIndex)
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        setCurrentIndex(currentIndex - 1)
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        setCurrentIndex(currentIndex + 1)
      }
      return updated
    })
  }, [currentIndex])

  // Broadcast Actions
  const handleStartBroadcast = useCallback(async () => {
    if (playlist.length === 0) {
      alert('Tambahkan video ke antrean playlist terlebih dahulu!')
      return
    }

    const res = await window.electronAPI.startBroadcast(playlist, srtConfig, encodingSettings, currentIndex)
    if (!res.success) {
      alert(res.message || 'Gagal memulai broadcast SRT')
    }
  }, [playlist, srtConfig, encodingSettings, currentIndex])

  const handleStopBroadcast = useCallback(async () => {
    await window.electronAPI.stopBroadcast()
  }, [])

  // Toggle Aux Window
  const handleToggleSecondary = useCallback(async () => {
    if (window.electronAPI) {
      const active = await window.electronAPI.toggleSecondaryWindow()
      setIsSecondaryActive(active)
      if (active && currentItem) {
        setTimeout(() => {
          window.electronAPI.sendToSecondaryWindow('sync:media', {
            filePath: currentItem.filePath,
            fileName: currentItem.fileName
          })
          window.electronAPI.sendToSecondaryWindow('sync:playback', {
            action: isPlaying ? 'play' : 'pause',
            time: currentTime
          })
        }, 500)
      }
    }
  }, [currentItem, isPlaying, currentTime])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          if (isPlaying) handlePause()
          else handlePlay()
          break
        case 'KeyS':
          e.preventDefault()
          handleStop()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.ctrlKey) handlePrev()
          else handleSeek(Math.max(0, currentTime - 5))
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.ctrlKey) handleNext()
          else handleSeek(Math.min(duration, currentTime + 5))
          break
        case 'Comma': // < key: Step back 1 frame
          e.preventDefault()
          handleStepFrame(-1)
          break
        case 'Period': // > key: Step forward 1 frame
          e.preventDefault()
          handleStepFrame(1)
          break
        case 'KeyM':
          e.preventDefault()
          setIsMuted(!isMuted)
          break
        case 'KeyB':
          e.preventDefault()
          if (telemetry.status === 'LIVE' || telemetry.status === 'CONNECTING') {
            handleStopBroadcast()
          } else {
            handleStartBroadcast()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isPlaying,
    currentTime,
    duration,
    isMuted,
    telemetry.status,
    handlePlay,
    handlePause,
    handleStop,
    handlePrev,
    handleNext,
    handleSeek,
    handleStepFrame,
    handleStartBroadcast,
    handleStopBroadcast
  ])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0e14] text-gray-100 select-none overflow-hidden font-sans">
      {/* Header */}
      <Header
        broadcastStatus={telemetry.status}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleSecondary={handleToggleSecondary}
        isSecondaryActive={isSecondaryActive}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Workspace: Left (Preview & Controls) + Right (Playlist Queue) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Player & Controls */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0e14]">
          {/* Video Preview Canvas */}
          <VideoPlayer
            currentItem={currentItem}
            isPlaying={isPlaying}
            volume={volume}
            isMuted={isMuted}
            onTimeUpdate={(t, d) => {
              setCurrentTime(t)
              setDuration(d)
              // Sync time with secondary preview periodically
              if (isSecondaryActive && Math.floor(t * 2) % 4 === 0) {
                syncPlaybackAction('syncTime', t)
              }
            }}
            onEnded={handleEnded}
            onDurationChange={(d) => setDuration(d)}
            seekTarget={seekTarget}
            stepFrameDelta={stepFrameDelta}
            onStepFrameHandled={handleStepFrameHandled}
          />

          {/* Playback Controls & Scrubber */}
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
            onPrev={handlePrev}
            onNext={handleNext}
            onStepFrame={handleStepFrame}
            onVolumeChange={(v) => {
              setVolume(v)
              if (isMuted && v > 0) setIsMuted(false)
            }}
            onToggleMute={() => setIsMuted(!isMuted)}
            hasItems={playlist.length > 0}
          />
        </div>

        {/* Right Column: Queue & Playlist Management */}
        <PlaylistQueue
          playlist={playlist}
          currentIndex={currentIndex}
          playbackMode={playbackMode}
          onSelectIndex={(idx) => {
            setCurrentIndex(idx)
            setCurrentTime(0)
            setSeekTarget(0)
            setIsPlaying(true)
            syncPlaybackAction('play')
          }}
          onAddFiles={handleAddFiles}
          onClearPlaylist={handleClearPlaylist}
          onRemoveItem={handleRemoveItem}
          onDuplicateItem={handleDuplicateItem}
          onMoveItem={handleMoveItem}
          onChangeMode={(mode) => setPlaybackMode(mode)}
          onDropFiles={handleDropFiles}
        />
      </div>

      {/* Bottom SRT Broadcast Panel (Wireframe Section 6) */}
      <SrtBroadcastPanel
        config={srtConfig}
        onChangeConfig={(newCfg) => setSrtConfig(newCfg)}
        telemetry={telemetry}
        onStartBroadcast={handleStartBroadcast}
        onStopBroadcast={handleStopBroadcast}
        isBroadcasting={telemetry.status === 'LIVE' || telemetry.status === 'CONNECTING' || telemetry.status === 'RECONNECTING'}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={encodingSettings}
        onSave={(newSettings) => setEncodingSettings(newSettings)}
        isBroadcasting={telemetry.status === 'LIVE'}
      />

      {/* Help & Workflow Guide Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151924] border border-[#262f47] rounded-xl w-full max-w-lg shadow-2xl p-5 text-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#262f47]">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                  Panduan Penggunaan & Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#202738]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div>
                <h4 className="font-semibold text-blue-400 mb-1 flex items-center space-x-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Koneksi SRT ke vMix / OBS Studio</span>
                </h4>
                <p className="text-gray-400 leading-relaxed">
                  <b>Caller Mode:</b> Masukkan IP & port target (misal laptop vMix `192.168.1.50:9000`). vMix membuka `Add Input &gt; Stream / SRT &gt; Type: SRT (Listener) &gt; Port: 9000`.
                </p>
                <p className="text-gray-400 leading-relaxed mt-1">
                  <b>Listener Mode:</b> PlayoutStream membuka port (misal `9000`). Di OBS/vMix, tambahkan Media Source / SRT Caller ke `srt://&lt;IP-Komputer-Ini&gt;:9000?mode=caller`.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-blue-400 mb-1 flex items-center space-x-1.5">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Keyboard Shortcuts</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-[#11141e] p-2.5 rounded border border-[#23293d]">
                  <div><span className="text-emerald-400">Space:</span> Play / Pause</div>
                  <div><span className="text-emerald-400">S:</span> Stop Playback</div>
                  <div><span className="text-emerald-400">Ctrl + Left / Right:</span> Prev / Next Clip</div>
                  <div><span className="text-emerald-400">, / . :</span> Step -1 / +1 Frame</div>
                  <div><span className="text-emerald-400">M:</span> Mute / Unmute</div>
                  <div><span className="text-emerald-400">B:</span> Start / Stop SRT Broadcast</div>
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

