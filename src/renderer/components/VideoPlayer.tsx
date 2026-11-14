import React, { useRef, useEffect, useState } from 'react'
import { Maximize2, Minimize2, VideoOff, Film } from 'lucide-react'
import { PlaylistItem } from '../../types'
import { AudioPeakMeter } from './AudioPeakMeter'

interface VideoPlayerProps {
  currentItem: PlaylistItem | null
  isPlaying: boolean
  volume: number
  isMuted: boolean
  onTimeUpdate: (currentTime: number, duration: number) => void
  onEnded: () => void
  onDurationChange: (duration: number) => void
  seekTarget: number | null
  stepFrameDelta: number | null
  onStepFrameHandled: () => void
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  currentItem,
  isPlaying,
  volume,
  isMuted,
  onTimeUpdate,
  onEnded,
  onDurationChange,
  seekTarget,
  stepFrameDelta,
  onStepFrameHandled
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [leftLevel, setLeftLevel] = useState(0)
  const [rightLevel, setRightLevel] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Web Audio Context for Peak Meter
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Construct valid media-file:/// URL for local video streaming with 3 slashes
  const formatMediaUrl = (filePath: string) => {
    if (!filePath) return ''
    const normalized = filePath.replace(/\\/g, '/')
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
    return `media-file://${withSlash}`
  }

  const videoSrc = currentItem ? formatMediaUrl(currentItem.filePath) : ''

  // Sync isPlaying state with video element
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    setLoadError(null)

    if (isPlaying) {
      // Resume audio context if suspended by browser autoplay policy
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {})
      }
      video.play().catch((err) => {
        console.warn('Autoplay or video play error:', err)
      })
    } else {
      video.pause()
    }
  }, [isPlaying, videoSrc])

  // Sync volume and mute
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = isMuted
  }, [volume, isMuted])

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
          // Add slight stereo simulation variance for L/R
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
      console.warn('Web Audio setup not available or already attached:', e)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying, volume, isMuted])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-black flex items-center justify-center overflow-hidden border border-[#1e2436] rounded-md m-3 mb-0 group"
    >
      {/* Video element or placeholder */}
      {currentItem ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            playsInline
            preload="auto"
            crossOrigin="anonymous"
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
            onCanPlay={() => {
              setLoadError(null)
            }}
            onError={(e) => {
              const err = videoRef.current?.error
              console.error('Video element error:', err)
              setLoadError(`Gagal membaca stream video: ${err?.message || 'File tidak dapat diakses'}`)
            }}
            onEnded={onEnded}
          />

          {loadError && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="p-3 bg-red-950/60 border border-red-700 rounded-lg max-w-md text-red-200 text-xs">
                <p className="font-bold text-red-400 mb-1">Peringatan Player</p>
                <p>{loadError}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#141824] flex items-center justify-center border border-[#21293e]">
            <Film className="w-8 h-8 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">Tidak ada media yang dimuat</p>
            <p className="text-xs text-gray-400 mt-1">Tarik & letakkan video ke antrean atau klik Tambah Media</p>
          </div>
        </div>
      )}

      {/* Top Overlay HUD: Clip Title & Badges */}
      {currentItem && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 text-xs">
            <span className="font-semibold text-white truncate max-w-sm">{currentItem.fileName}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-600/40 text-blue-300 text-[10px] font-mono border border-blue-500/30">
              {currentItem.resolution} @ {currentItem.fps} fps
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 text-[10px] font-mono">
              {currentItem.format?.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center space-x-2 pointer-events-auto">
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded bg-black/70 backdrop-blur-md text-gray-300 hover:text-white hover:bg-black/90 border border-white/10 transition-colors"
              title="Toggle Fullscreen Preview"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Right Audio VU Meter Widget */}
      <div className="absolute bottom-4 right-4 pointer-events-auto shadow-2xl">
        <AudioPeakMeter leftLevel={leftLevel} rightLevel={rightLevel} isMuted={isMuted} />
      </div>
    </div>
  )
}
