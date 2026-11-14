import React from 'react'
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Repeat,
  RotateCcw
} from 'lucide-react'

interface PlaybackControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (time: number) => void
  onPrev: () => void
  onNext: () => void
  onStepFrame: (frames: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  hasItems: boolean
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onPrev,
  onNext,
  onStepFrame,
  onVolumeChange,
  onToggleMute,
  hasItems
}) => {
  // Format seconds into HH:MM:SS:FF or HH:MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    const f = Math.floor((secs % 1) * 30) // 30 fps frames
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(f)}`
  }

  const remainingTime = Math.max(0, duration - currentTime)

  return (
    <div className="bg-[#12151f] border-t border-[#23293d] p-3 flex flex-col space-y-2 select-none">
      {/* Scrubber and Timecode Row */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <span className="text-emerald-400 font-bold tracking-wider w-24 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Custom Progress Bar / Scrubber */}
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            disabled={!hasItems || duration <= 0}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg bg-[#1c2233] cursor-pointer appearance-none transition-all disabled:opacity-40"
            style={{
              background: `linear-gradient(to right, #3b82f6 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #1e2436 ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`
            }}
          />
        </div>

        <div className="flex items-center space-x-2 text-gray-400 font-medium">
          <span className="text-gray-300">/ {formatTime(duration)}</span>
          <span className="text-amber-400/80 font-bold">[-{formatTime(remainingTime)}]</span>
        </div>
      </div>

      {/* Primary Buttons & Volume Row */}
      <div className="flex items-center justify-between pt-1">
        {/* Left Side: Step controls & Track skips */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onPrev}
            disabled={!hasItems}
            className="p-1.5 rounded bg-[#1a1f2e] text-gray-300 hover:bg-[#252d42] hover:text-white disabled:opacity-30 border border-[#262f47] transition-colors"
            title="Previous Clip (Ctrl+Left)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => onStepFrame(-1)}
            disabled={!hasItems}
            className="flex items-center px-2 py-1 rounded bg-[#1a1f2e] text-gray-300 hover:bg-[#252d42] hover:text-white disabled:opacity-30 border border-[#262f47] text-[11px] font-mono transition-colors"
            title="Step Back 1 Frame"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
            <span>-1F</span>
          </button>

          {/* Main Play / Pause / Stop buttons */}
          {isPlaying ? (
            <button
              onClick={onPause}
              disabled={!hasItems}
              className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center space-x-1.5 shadow-md shadow-amber-600/20 text-xs transition-all disabled:opacity-30"
              title="Pause (Space)"
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>PAUSE</span>
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={!hasItems}
              className="px-5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center space-x-1.5 shadow-md shadow-blue-600/30 text-xs transition-all disabled:opacity-30"
              title="Play (Space)"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>PLAY</span>
            </button>
          )}

          <button
            onClick={onStop}
            disabled={!hasItems}
            className="px-3 py-1.5 rounded bg-[#1f2436] hover:bg-red-950/40 hover:text-red-400 text-gray-300 border border-[#2e374f] text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-30"
            title="Stop & Reset to Start"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>STOP</span>
          </button>

          <button
            onClick={() => onStepFrame(1)}
            disabled={!hasItems}
            className="flex items-center px-2 py-1 rounded bg-[#1a1f2e] text-gray-300 hover:bg-[#252d42] hover:text-white disabled:opacity-30 border border-[#262f47] text-[11px] font-mono transition-colors"
            title="Step Forward 1 Frame"
          >
            <span>+1F</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>

          <button
            onClick={onNext}
            disabled={!hasItems}
            className="p-1.5 rounded bg-[#1a1f2e] text-gray-300 hover:bg-[#252d42] hover:text-white disabled:opacity-30 border border-[#262f47] transition-colors"
            title="Next Clip (Ctrl+Right)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: Volume & Mute Controls */}
        <div className="flex items-center space-x-3 bg-[#161a26] border border-[#22283b] px-3 py-1 rounded">
          <button
            onClick={onToggleMute}
            className="text-gray-400 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-gray-300" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-[#232b3d] rounded appearance-none cursor-pointer"
          />

          <span className="font-mono text-[11px] text-gray-400 w-9 text-right font-semibold">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  )
}

