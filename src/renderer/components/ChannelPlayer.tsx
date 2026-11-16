import React, { useRef, useEffect, useState } from 'react'
import {
  Play,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  Film,
  X,
  UploadCloud,
  FileVideo,
  SkipForward
} from 'lucide-react'
import { PlaylistItem } from '../../types'
import { AudioPeakMeter } from './AudioPeakMeter'

interface ChannelPlayerProps {
  channelId: 'A' | 'B'
  channelTitle: string
  themeColor: 'blue' | 'emerald'
  currentItem: PlaylistItem | null
  isPlaying: boolean
  isLooping: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  seekTarget: number | null
  stepFrameDelta: number | null
  isLiveOnAir?: boolean
  onPlay: () => void
  onStop: () => void
  onNextItem: () => void
  onToggleLoop: () => void
  onSeek: (time: number) => void
  onTimeUpdate: (currentTime: number, duration: number) => void
  onDurationChange: (duration: number) => void
  onEnded: () => void
  onStepFrameHandled: () => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onClearItem: () => void
  onDropItem: (item: PlaylistItem | string) => void
  onPickFile: () => void
}

export const ChannelPlayer: React.FC<ChannelPlayerProps> = ({
  channelId,
  channelTitle,
  themeColor,
  currentItem,
  isPlaying,
  isLooping,
  currentTime,
  duration,
  volume,
  isMuted,
  seekTarget,
  stepFrameDelta,
  isLiveOnAir = false,
  onPlay,
  onStop,
  onNextItem,
  onToggleLoop,
  onSeek,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onStepFrameHandled,
  onVolumeChange,
  onToggleMute,
  onClearItem,
  onDropItem,
  onPickFile
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [leftLevel, setLeftLevel] = useState(0)
  const [rightLevel, setRightLevel] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [proxyProgress, setProxyProgress] = useState<number>(0)
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false)
  const [isDragOverSlot, setIsDragOverSlot] = useState<boolean>(false)
  const [proxyVersion, setProxyVersion] = useState<number>(Date.now())

  // Listen for proxy progress events
  useEffect(() => {
    if (!window.electronAPI?.onProxyProgress) return

    const cleanup = window.electronAPI.onProxyProgress((data) => {
      if (currentItem && data.filePath === currentItem.filePath) {
        setProxyProgress(data.progress)
        if (data.status === 'processing') {
          setIsOptimizing(true)
          setLoadError(null)
        } else if (data.status === 'ready') {
          setIsOptimizing(false)
          setLoadError(null)
          setProxyVersion(Date.now())
          if (videoRef.current) {
            videoRef.current.load()
            if (isPlaying) {
              videoRef.current.play().catch(() => {})
            }
          }
        } else if (data.status === 'error') {
          setIsOptimizing(false)
        }
      }
    })

    return cleanup
  }, [currentItem, isPlaying])

  // Track initial proxy state when currentItem changes
  useEffect(() => {
    if (currentItem?.needsProxy && !currentItem?.isProxyReady) {
      setIsOptimizing(true)
      setProxyProgress(currentItem.proxyProgress || 0)
    } else {
      setIsOptimizing(false)
    }
  }, [currentItem])

  // Web Audio Context for Peak Meter
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const formatMediaUrl = (filePath: string) => {
    if (!filePath) return ''
    const normalized = filePath.replace(/\\/g, '/')
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
    return `media-file://${withSlash}?v=${proxyVersion}`
  }

  const videoSrc = currentItem ? formatMediaUrl(currentItem.filePath) : ''

  // Sync isPlaying state with video element
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    setLoadError(null)

    if (isPlaying) {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {})
      }
      video.play().catch((err) => {
        console.warn(`[CH ${channelId}] Video play warning:`, err)
      })
    } else {
      video.pause()
    }
  }, [isPlaying, videoSrc, channelId])

  // Sync volume and mute
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = isMuted
  }, [volume, isMuted])

  // Sync native loop attribute directly on video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = isLooping
    }
  }, [isLooping])

  // Handle external seek requests
  useEffect(() => {
    if (seekTarget !== null && videoRef.current) {
      videoRef.current.currentTime = seekTarget
    }
  }, [seekTarget])

  // Handle step frame requests
  useEffect(() => {
    if (stepFrameDelta !== null && videoRef.current) {
      const fps = currentItem?.fps || 30
      const frameDuration = 1 / fps
      const newTime = Math.max(0, videoRef.current.currentTime + stepFrameDelta * frameDuration)
      videoRef.current.currentTime = newTime
      onStepFrameHandled()
    }
  }, [stepFrameDelta, currentItem, onStepFrameHandled])

  // Setup Web Audio Analyser for VU Meter
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx()
      }
      const ctx = audioContextRef.current

      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(video)
        analyserRef.current = ctx.createAnalyser()
        analyserRef.current.fftSize = 256
        sourceRef.current.connect(analyserRef.current)
        analyserRef.current.connect(ctx.destination)
      }

      const analyser = analyserRef.current
      if (!analyser) return
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateMeters = () => {
        if (analyser && isPlaying && !isMuted) {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
          }
          const avg = sum / bufferLength / 255
          const l = Math.min(1, avg * (volume * 1.3))
          const r = Math.min(1, avg * (volume * 1.25) * 0.96)
          setLeftLevel(l)
          setRightLevel(r)
        } else {
          setLeftLevel(0)
          setRightLevel(0)
        }
        animFrameRef.current = requestAnimationFrame(updateMeters)
      }

      animFrameRef.current = requestAnimationFrame(updateMeters)
    } catch (e) {
      // Audio node already attached
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying, volume, isMuted])

  // Time format helpers
  const formatTimecode = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }

  const remainingSecs = Math.max(0, duration - currentTime)

  const isBlue = themeColor === 'blue'
  const pullShortcut = isBlue ? 'F1' : 'F5'
  const nextShortcut = isBlue ? 'F2' : 'F6'
  const playShortcut = isBlue ? 'F3' : 'F7'
  const loopShortcut = isBlue ? 'F4' : 'F8'

  // Drag over drop slot
  const handleSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverSlot(true)
  }

  const handleSlotDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverSlot(false)
  }

  const handleSlotDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverSlot(false)

    const jsonStr = e.dataTransfer.getData('application/json')
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        onDropItem(parsed)
        return
      } catch (err) {}
    }

    const plainPath = e.dataTransfer.getData('text/plain')
    if (plainPath) {
      onDropItem(plainPath)
      return
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fPath = (e.dataTransfer.files[0] as any).path
      if (fPath) onDropItem(fPath)
    }
  }

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 bg-[#0e111a] border rounded-lg overflow-hidden select-none transition-colors ${
        isBlue
          ? 'border-blue-900/40 shadow-lg shadow-blue-950/20'
          : 'border-emerald-900/40 shadow-lg shadow-emerald-950/20'
      }`}
    >
      {/* 1. Clean Top Header: CHANNEL A / CHANNEL B [MAIN] */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between border-b shrink-0 ${
          isBlue ? 'bg-blue-950/30 border-blue-900/30' : 'bg-emerald-950/30 border-emerald-900/30'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-black tracking-wider uppercase border shadow-sm ${
              isBlue
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-emerald-600 text-white border-emerald-400'
            }`}
          >
            {channelTitle}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[#181f30] text-gray-300 text-[10px] font-bold border border-[#27324c]">
            MAIN
          </span>

          {isLiveOnAir && (
            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              <span>LIVE</span>
            </span>
          )}
        </div>

        {/* Small Play Status Badge */}
        <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold">
          {currentItem
            ? isPlaying
              ? '▶ PLAYING'
              : currentTime > 0
              ? '⏸ PAUSED'
              : '⏹ READY'
            : '○ EMPTY'}
        </span>
      </div>

      {/* 2. Video Preview Screen (Clean Video + Translucent Audio VU Meter + Hover Countdown HUD) */}
      <div className="group/preview relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[240px]">
        {currentItem ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              loop={isLooping}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration || currentItem.duration)
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  onDurationChange(videoRef.current.duration || currentItem.duration)
                }
              }}
              onCanPlay={() => setLoadError(null)}
              onError={(e) => {
                if (isOptimizing) return
                const err = videoRef.current?.error
                setLoadError(`Gagal membaca stream video: ${err?.message || 'File tidak dapat diakses'}`)
              }}
              onEnded={() => {
                if (!isLooping) {
                  onEnded()
                }
              }}
            />

            {/* Optimization HUD if MXF/Broadcast format is preparing */}
            {isOptimizing && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20">
                <div className="p-4 bg-[#141824]/95 border border-blue-500/40 rounded-xl shadow-2xl max-w-xs flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="font-semibold text-white text-xs">Menyiapkan Preview Broadcast...</p>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${Math.max(10, proxyProgress)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {loadError && !isOptimizing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
                <div className="p-3 bg-red-950/80 border border-red-700 rounded-lg max-w-sm text-red-200 text-xs">
                  <p className="font-bold text-red-400 mb-1">Peringatan Player</p>
                  <p>{loadError}</p>
                </div>
              </div>
            )}

            {/* 🎯 Prominent Hover Countdown HUD at Bottom of Preview */}
            <div className="absolute bottom-2.5 left-2.5 right-20 pointer-events-none z-10 transition-all duration-200 opacity-90 group-hover/preview:opacity-100">
              <div className="inline-flex items-center space-x-3 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/15 shadow-2xl">
                {/* Big Countdown Number */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-gray-400">
                    COUNTDOWN
                  </span>
                  <span
                    className={`font-mono font-black text-2xl tracking-wider leading-none mt-0.5 ${
                      remainingSecs <= 5 && isPlaying
                        ? 'text-red-400 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]'
                        : remainingSecs <= 10 && isPlaying
                        ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                        : isBlue
                        ? 'text-blue-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    -{formatTimecode(remainingSecs)}
                  </span>
                </div>

                {/* Vertical Divider */}
                <div className="h-7 w-px bg-white/20 self-center" />

                {/* Elapsed / Total Duration */}
                <div className="flex flex-col justify-center text-xs font-mono">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider">ELAPSED / TOTAL</span>
                  <div className="flex items-center space-x-1 font-semibold text-gray-200 mt-0.5">
                    <span className="text-gray-300">{formatTimecode(currentTime)}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-400">{formatTimecode(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio VU Peak Meter (Corner Widget - Translucent) */}
            <div className="absolute bottom-2.5 right-2.5 pointer-events-auto shadow-xl z-20">
              <AudioPeakMeter leftLevel={leftLevel} rightLevel={rightLevel} isMuted={isMuted} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600 p-6 text-center space-y-2">
            <Film className={`w-10 h-10 ${isBlue ? 'text-blue-500/30' : 'text-emerald-500/30'}`} />
            <p className="text-xs font-semibold text-gray-500">Tidak ada video yang dimuat</p>
          </div>
        )}
      </div>

      {/* 3. Kotak untuk Tarik Materi (Drop Zone Slot Box) */}
      <div
        onDragOver={handleSlotDragOver}
        onDragLeave={handleSlotDragLeave}
        onDrop={handleSlotDrop}
        className={`mx-3 my-2 border-2 border-dashed rounded-lg p-2 transition-all ${
          isDragOverSlot
            ? 'bg-blue-950/50 border-blue-400 ring-2 ring-blue-500/40'
            : currentItem
            ? 'bg-[#121622] border-[#29334c]'
            : 'bg-[#10141f]/70 border-[#222a3d] hover:border-gray-500/50'
        }`}
      >
        {currentItem ? (
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-12 h-8 rounded bg-black overflow-hidden shrink-0 border border-[#2b354d]">
                {currentItem.thumbnail ? (
                  <img src={currentItem.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#151926]">
                    <FileVideo className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate" title={currentItem.fileName}>
                  {currentItem.fileName}
                </p>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400">
                  <span className="text-emerald-400 font-semibold">{currentItem.durationFormatted}</span>
                  <span>•</span>
                  <span>{currentItem.resolution}</span>
                  {currentItem.needsProxy && (
                    <span className="px-1 rounded bg-purple-900/60 text-purple-300 font-bold text-[8px]">
                      {currentItem.format?.toUpperCase() || 'PROXY'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClearItem}
              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Keluarkan materi dari channel ini"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={onPickFile}
            className="flex items-center justify-center space-x-2 py-1.5 cursor-pointer text-gray-400 hover:text-gray-200 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium">
              Tarik materi ke sini (<b className={isBlue ? 'text-blue-400' : 'text-emerald-400'}>{pullShortcut}</b>) atau klik untuk memilih file
            </span>
          </div>
        )}
      </div>

      {/* 4. Controls Row: Icon Start/Stop, Next Item, Icon Loop, Scrubber, & Volume */}
      <div className="px-3 pb-2 pt-1 bg-[#0c0f16] border-t border-[#1a1f2e] flex flex-col space-y-1.5 shrink-0">
        {/* Scrubber Progress Slider */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            disabled={!currentItem || duration <= 0}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg bg-[#181d2a] cursor-pointer appearance-none transition-all disabled:opacity-30"
            style={{
              background: `linear-gradient(to right, ${
                isBlue ? '#3b82f6' : '#10b981'
              } ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #1e2436 ${
                duration > 0 ? (currentTime / duration) * 100 : 0
              }%)`
            }}
          />
        </div>

        {/* Icons Row: Start/Stop, Next Item, Loop, & Volume */}
        <div className="flex items-center justify-between">
          {/* Left: Icon Start/Stop, Next Item, & Icon Loop */}
          <div className="flex items-center space-x-1.5">
            {/* Start / Stop Button (Icon only) */}
            <button
              onClick={isPlaying ? onStop : onPlay}
              disabled={!currentItem}
              className={`p-2 rounded-md shadow transition-all ${
                !currentItem
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-40'
                  : isPlaying
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : isBlue
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
              title={`Play / Stop (${playShortcut})`}
            >
              {isPlaying ? (
                <Square className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
            </button>

            {/* Next Item Button */}
            <button
              onClick={onNextItem}
              className="p-2 rounded-md bg-[#181d2c] hover:bg-[#222a3d] text-gray-300 hover:text-white border border-[#27324c] transition-colors"
              title={`Next Item (${nextShortcut}) - Pindah ke video berikutnya yang belum di channel lain`}
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Loop Toggle Button (Icon only with active state) */}
            <button
              onClick={onToggleLoop}
              className={`p-2 rounded-md border transition-all ${
                isLooping
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30 ring-1 ring-amber-400'
                  : 'bg-[#181d2c] hover:bg-[#222a3d] text-gray-400 hover:text-white border-[#27324c]'
              }`}
              title={`Toggle Loop (${loopShortcut}): ${isLooping ? 'ON' : 'OFF'}`}
            >
              <Repeat className={`w-4 h-4 ${isLooping ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Volume Mute & Slider */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onToggleMute}
              className="p-1 rounded text-gray-400 hover:text-white transition-colors"
              title="Mute / Unmute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 rounded bg-[#1f2638] cursor-pointer appearance-none"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
