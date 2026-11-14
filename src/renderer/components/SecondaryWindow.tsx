import React, { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export const SecondaryWindow: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoSrc, setVideoSrc] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  useEffect(() => {
    // Listen for sync events from primary window
    const cleanup = window.electronAPI.onReceiveFromPrimaryWindow((channel, data) => {
      if (channel === 'sync:media') {
        if (data.filePath) {
          const normalized = data.filePath.replace(/\\/g, '/')
          const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
          const src = `media-file://${withSlash}`
          setVideoSrc(src)
          setFileName(data.fileName || '')
        } else {
          setVideoSrc('')
          setFileName('')
        }
      } else if (channel === 'sync:playback') {
        const video = videoRef.current
        if (!video) return

        if (data.action === 'play') {
          video.play().catch(() => {})
        } else if (data.action === 'pause') {
          video.pause()
        } else if (data.action === 'seek') {
          video.currentTime = data.time
        } else if (data.action === 'syncTime') {
          // If out of sync by more than 0.3s, nudge time
          if (Math.abs(video.currentTime - data.time) > 0.3) {
            video.currentTime = data.time
          }
        }
      }
    })

    return cleanup
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  return (
    <div className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden group select-none">
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          muted
        />
      ) : (
        <div className="text-center text-gray-600 font-mono text-sm">
          <p>AUXILIARY MONITOR FEED (STANDBY)</p>
          <p className="text-xs text-gray-700 mt-1">Menunggu media dari kontrol utama...</p>
        </div>
      )}

      {/* Floating Fullscreen button on hover */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded bg-black/60 backdrop-blur-md text-white hover:bg-black/90 border border-white/20 shadow-lg"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Subtle Bottom Clip Info */}
      {fileName && (
        <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-3 py-1 rounded text-xs text-white/80 font-mono">
          {fileName}
        </div>
      )}
    </div>
  )
}

export default SecondaryWindow

