import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Repeat,
  RotateCcw,
  ListOrdered,
  PauseCircle,
  Play,
  Film,
  GripVertical
} from 'lucide-react'
import { PlaylistItem, PlaybackMode } from '../../types'

interface PlaylistQueueProps {
  playlist: PlaylistItem[]
  currentIndex: number
  playbackMode: PlaybackMode
  onSelectIndex: (index: number) => void
  onAddFiles: () => void
  onClearPlaylist: () => void
  onRemoveItem: (index: number) => void
  onDuplicateItem: (index: number) => void
  onMoveItem: (fromIndex: number, toIndex: number) => void
  onChangeMode: (mode: PlaybackMode) => void
  onDropFiles: (files: FileList | string[]) => void
}

export const PlaylistQueue: React.FC<PlaylistQueueProps> = ({
  playlist,
  currentIndex,
  playbackMode,
  onSelectIndex,
  onAddFiles,
  onClearPlaylist,
  onRemoveItem,
  onDuplicateItem,
  onMoveItem,
  onChangeMode,
  onDropFiles
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  // Calculate total playlist duration
  const totalSeconds = playlist.reduce((acc, item) => acc + (item.duration || 0), 0)
  const formatTotalTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }

  // Handle Drag and Drop from OS Explorer
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Pass FileList to parent
      onDropFiles(e.dataTransfer.files)
    }
  }

  // Handle Item Reorder Dragging
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation()
    setDraggedIdx(index)
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleItemDropOn = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIdx !== null && draggedIdx !== targetIndex) {
      onMoveItem(draggedIdx, targetIndex)
    }
    setDraggedIdx(null)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-96 bg-[#12151f] border-l border-[#23293d] flex flex-col h-full select-none transition-colors ${
        isDragOver ? 'bg-blue-950/20 ring-2 ring-blue-500/50' : ''
      }`}
    >
      {/* Queue Header & Actions */}
      <div className="p-3 border-b border-[#23293d] flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-200">Playout Queue</h2>
            <span className="px-1.5 py-0.5 rounded-full bg-[#1e2538] text-blue-400 font-mono text-[10px] font-bold">
              {playlist.length}
            </span>
          </div>
          <p className="text-[10px] font-mono text-gray-400 mt-0.5">
            Total: {formatTotalTime(totalSeconds)}
          </p>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onAddFiles}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-colors"
            title="Add Media Files"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          <button
            onClick={onClearPlaylist}
            disabled={playlist.length === 0}
            className="p-1.5 rounded bg-[#1a1f2e] text-gray-400 hover:text-red-400 hover:bg-red-950/30 border border-[#262f47] disabled:opacity-30 transition-colors"
            title="Clear All Queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Playlist Items Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {playlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <div className="w-12 h-12 rounded-full bg-[#181d2a] border border-[#232a3d] flex items-center justify-center mb-3">
              <Film className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-xs font-semibold text-gray-400">Antrean Kosong</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Drag & drop video (.mp4, .mov, .mkv, .ts) ke sini atau klik tombol <b>+ Add</b>.
            </p>
          </div>
        ) : (
          playlist.map((item, idx) => {
            const isActive = idx === currentIndex
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleItemDropOn(e, idx)}
                onClick={() => onSelectIndex(idx)}
                className={`group relative rounded-md border p-2 flex items-center space-x-2.5 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-500/10'
                    : 'bg-[#161a26] border-[#22283b] hover:border-[#353e59] hover:bg-[#1a2030]'
                }`}
              >
                {/* Drag handle */}
                <div
                  className="text-gray-500 group-hover:text-gray-300 cursor-grab active:cursor-grabbing p-0.5"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Index / Status Icon */}
                <div className="w-5 text-center shrink-0">
                  {isActive ? (
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
                  ) : (
                    <span className="text-[11px] font-mono text-gray-400 font-bold">{idx + 1}</span>
                  )}
                </div>

                {/* Thumbnail Preview */}
                <div className="w-14 h-9 rounded bg-black shrink-0 overflow-hidden relative border border-[#2a3249]">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#131622]">
                      <Film className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                  )}
                </div>

                {/* Metadata Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-blue-300 font-semibold' : 'text-gray-200'
                      }`}
                      title={item.fileName}
                    >
                      {item.fileName}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 mt-1 text-[10px] font-mono text-gray-400">
                    <span className="text-emerald-400 font-semibold">{item.durationFormatted}</span>
                    <span>•</span>
                    <span>{item.resolution}</span>
                    <span>•</span>
                    <span>{item.fps}fps</span>
                  </div>
                </div>

                {/* Item Actions (on hover) */}
                <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (idx > 0) onMoveItem(idx, idx - 1)
                    }}
                    disabled={idx === 0}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252c40] disabled:opacity-20"
                    title="Move Up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (idx < playlist.length - 1) onMoveItem(idx, idx + 1)
                    }}
                    disabled={idx === playlist.length - 1}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252c40] disabled:opacity-20"
                    title="Move Down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicateItem(idx)
                    }}
                    className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-[#252c40]"
                    title="Duplicate Clip"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveItem(idx)
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/40"
                    title="Remove from Queue"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Playback Mode Selector Toolbar (FR-2.5) */}
      <div className="p-3 bg-[#0e1118] border-t border-[#23293d] shrink-0">
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
          Playout Automation Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onChangeMode('sequential')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
              playbackMode === 'sequential'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#181d2a] text-gray-300 border-[#232a3d] hover:bg-[#202738]'
            }`}
            title="Sequential: Play top to bottom"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Sequential</span>
          </button>

          <button
            onClick={() => onChangeMode('manual_cue')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
              playbackMode === 'manual_cue'
                ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                : 'bg-[#181d2a] text-gray-300 border-[#232a3d] hover:bg-[#202738]'
            }`}
            title="Manual Cue: Pause at frame 0 of next clip (Standby)"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Manual Cue</span>
          </button>

          <button
            onClick={() => onChangeMode('loop_item')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
              playbackMode === 'loop_item'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#181d2a] text-gray-300 border-[#232a3d] hover:bg-[#202738]'
            }`}
            title="Loop Item: Repeat current active video continuously"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop Clip</span>
          </button>

          <button
            onClick={() => onChangeMode('loop_playlist')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
              playbackMode === 'loop_playlist'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#181d2a] text-gray-300 border-[#232a3d] hover:bg-[#202738]'
            }`}
            title="Loop Playlist: Repeat entire queue continuously"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Loop All</span>
          </button>
        </div>
      </div>
    </div>
  )
}

