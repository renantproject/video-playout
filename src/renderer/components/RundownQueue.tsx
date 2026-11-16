import React, { useState } from 'react'
import {
  FolderOpen,
  Plus,
  Trash2,
  RefreshCw,
  Folder,
  ChevronDown,
  ChevronRight,
  Play,
  Film,
  Tv,
  CheckCircle2,
  GripVertical
} from 'lucide-react'
import { PlaylistItem, RundownProgram, RundownGroup } from '../../types'

interface RundownQueueProps {
  rundown: RundownProgram | null
  standalonePlaylist: PlaylistItem[]
  selectedClip: PlaylistItem | null
  channelAItem: PlaylistItem | null
  channelBItem: PlaylistItem | null
  onSelectClip: (clip: PlaylistItem) => void
  onLoadToChannelA: (clip: PlaylistItem) => void
  onLoadToChannelB: (clip: PlaylistItem) => void
  onOpenFolder: () => void
  onAddFiles: () => void
  onRefreshRundown: () => void
  onClearAll: () => void
  onDropFiles: (files: FileList | string[]) => void
  isLoadingFolder?: boolean
}

export const RundownQueue: React.FC<RundownQueueProps> = ({
  rundown,
  standalonePlaylist,
  selectedClip,
  channelAItem,
  channelBItem,
  onSelectClip,
  onLoadToChannelA,
  onLoadToChannelB,
  onOpenFolder,
  onAddFiles,
  onRefreshRundown,
  onClearAll,
  onDropFiles,
  isLoadingFolder = false
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [isDragOver, setIsDragOver] = useState(false)

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  // Count total clips
  const rundownClipsCount = rundown
    ? rundown.groups.reduce((acc, g) => acc + g.items.length, 0)
    : 0
  const totalClips = rundownClipsCount + standalonePlaylist.length

  // Drag and drop handling
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
      onDropFiles(e.dataTransfer.files)
    }
  }

  // Render a clip item card
  const renderClipItem = (item: PlaylistItem, indexNumber?: number) => {
    const isSelected = selectedClip?.id === item.id
    const isChannelA = channelAItem?.filePath === item.filePath
    const isChannelB = channelBItem?.filePath === item.filePath

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/json', JSON.stringify(item))
          e.dataTransfer.setData('text/plain', item.filePath)
          onSelectClip(item)
        }}
        onClick={() => onSelectClip(item)}
        className={`group relative rounded-md border p-2 flex items-center space-x-2 cursor-pointer transition-all ${
          isSelected
            ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/50 shadow-md'
            : isChannelA
            ? 'bg-blue-950/30 border-blue-800/80 hover:bg-blue-950/50'
            : isChannelB
            ? 'bg-emerald-950/30 border-emerald-800/80 hover:bg-emerald-950/50'
            : 'bg-[#151926] border-[#22283b] hover:border-[#384360] hover:bg-[#1a2032]'
        }`}
      >
        {/* Grip Handle */}
        <div className="text-gray-500 group-hover:text-gray-300 cursor-grab active:cursor-grabbing p-0.5 shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Index number or status dot */}
        <div className="w-4 text-center shrink-0">
          {isChannelA ? (
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" title="Aktif di CH A" />
          ) : isChannelB ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" title="Aktif di CH B" />
          ) : indexNumber !== undefined ? (
            <span className="text-[10px] font-mono text-gray-500 font-bold">{indexNumber}</span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
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
          {isChannelA && (
            <div className="absolute top-0.5 left-0.5 px-1 rounded bg-blue-600 text-white text-[8px] font-bold">
              CH A
            </div>
          )}
          {isChannelB && (
            <div className="absolute top-0.5 right-0.5 px-1 rounded bg-emerald-600 text-white text-[8px] font-bold">
              CH B
            </div>
          )}
        </div>

        {/* Details & Title */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold truncate ${
              isSelected ? 'text-blue-300' : 'text-gray-200'
            }`}
            title={item.fileName}
          >
            {item.fileName}
          </p>
          <div className="flex items-center space-x-1.5 mt-0.5 text-[10px] font-mono text-gray-400">
            <span className="text-emerald-400 font-bold">{item.durationFormatted}</span>
            <span>•</span>
            <span>{item.resolution}</span>
            <span>•</span>
            <span>{item.fps}fps</span>
            {item.needsProxy && (
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${
                  item.isProxyReady
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-900/60 text-amber-300 border border-amber-500/30 animate-pulse'
                }`}
                title={item.isProxyReady ? 'Preview Proxy Siap' : `Sedang membuat preview proxy (${item.proxyProgress || 0}%)`}
              >
                {item.isProxyReady ? 'PROXY READY' : `PROXY ${item.proxyProgress || 0}%`}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons to Pull into CH A or CH B */}
        <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          {/* Send to CH A (F1) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLoadToChannelA(item)
            }}
            className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              isChannelA
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-blue-950/60 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-700/50'
            }`}
            title="Tarik ke Channel A (F1)"
          >
            CH A
          </button>

          {/* Send to CH B (F5) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLoadToChannelB(item)
            }}
            className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              isChannelB
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                : 'bg-emerald-950/60 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-700/50'
            }`}
            title="Tarik ke Channel B (F5)"
          >
            CH B
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-96 bg-[#11141e] border-l border-[#23293d] flex flex-col h-full select-none transition-colors ${
        isDragOver ? 'bg-blue-950/20 ring-2 ring-blue-500/50' : ''
      }`}
    >
      {/* Top Header & Rundown Toolbar */}
      <div className="p-3 border-b border-[#23293d] flex items-center justify-between shrink-0 bg-[#0d1017]">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-200 flex items-center space-x-1.5">
              <Tv className="w-3.5 h-3.5 text-blue-400" />
              <span>Rundown & Playout</span>
            </h2>
            <span className="px-1.5 py-0.5 rounded-full bg-[#1b2234] text-blue-400 font-mono text-[10px] font-bold">
              {totalClips} Video
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
            Pilih video lalu tekan <b className="text-blue-400">F1 (CH A)</b> atau <b className="text-emerald-400">F5 (CH B)</b>
          </p>
        </div>

        {/* Buttons Row: Open Folder beside + Add */}
        <div className="flex items-center space-x-1.5">
          {/* Open Folder Button */}
          <button
            onClick={onOpenFolder}
            disabled={isLoadingFolder}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-[#1e2538] hover:bg-[#28324a] text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold shadow-sm transition-colors"
            title="Buka Folder Rundown / Program (misal KILAS KOMPAS)"
          >
            {isLoadingFolder ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>Folder</span>
          </button>

          {/* + Add Media Files Button */}
          <button
            onClick={onAddFiles}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-colors"
            title="Tambah File Media Manual (+ Add)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          {/* Refresh button */}
          {rundown && (
            <button
              onClick={onRefreshRundown}
              disabled={isLoadingFolder}
              className="p-1.5 rounded bg-[#1a1f2e] text-gray-400 hover:text-white hover:bg-[#252c40] border border-[#262f47] transition-colors"
              title="Refresh / Muat Ulang File di Folder Rundown"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFolder ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Clear button */}
          <button
            onClick={onClearAll}
            disabled={totalClips === 0}
            className="p-1.5 rounded bg-[#1a1f2e] text-gray-400 hover:text-red-400 hover:bg-red-950/30 border border-[#262f47] disabled:opacity-30 transition-colors"
            title="Bersihkan Semua Antrean"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Program Rundown Banner (if loaded) */}
      {rundown && (
        <div className="p-2.5 bg-gradient-to-r from-blue-950/60 to-[#141b2c] border-b border-[#23293d] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold tracking-wider uppercase text-blue-400 font-mono block">
                  PROGRAM RUNDOWN
                </span>
                <p className="text-xs font-bold text-white truncate" title={rundown.rootPath}>
                  {rundown.name}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#1c2438] text-[10px] font-mono text-gray-300 font-semibold shrink-0">
              {rundown.groups.length} Segmen
            </span>
          </div>
        </div>
      )}

      {/* Scrollable Content: Subfolders and Clips */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {totalClips === 0 && !isLoadingFolder && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <div className="w-14 h-14 rounded-full bg-[#181d2a] border border-[#232a3d] flex items-center justify-center mb-3">
              <FolderOpen className="w-7 h-7 text-blue-400/60" />
            </div>
            <p className="text-xs font-bold text-gray-300">Rundown / Antrean Masih Kosong</p>
            <p className="text-[11px] text-gray-500 mt-1.5 max-w-[240px] leading-relaxed">
              Klik <b>Folder</b> untuk memuat folder program (misal <i>KILAS KOMPAS 051224</i>) dengan subfolder <i>HL</i>, <i>SEG 1</i>, <i>SEG 2</i>, atau klik <b>+ Add</b>.
            </p>
          </div>
        )}

        {isLoadingFolder && (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <p className="text-xs text-gray-300 font-semibold">Memindai Folder Program & Subfolder...</p>
            <p className="text-[10px] text-gray-500">Mengekstrak metadata materi video broadcast</p>
          </div>
        )}

        {/* Rundown Groups (Subfolders like HL, SEG 1, SEG 2, SEG 3) */}
        {rundown &&
          rundown.groups.map((group) => {
            const isCollapsed = collapsedGroups[group.id]
            return (
              <div
                key={group.id}
                className="bg-[#141824] border border-[#242c42] rounded-lg overflow-hidden shadow-sm"
              >
                {/* Subfolder Group Header */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="px-3 py-2 bg-[#181d2d] hover:bg-[#1d2336] flex items-center justify-between cursor-pointer border-b border-[#23293d] transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                      <span>{group.name}</span>
                    </span>
                  </div>

                  <span className="px-1.5 py-0.5 rounded bg-[#10131d] text-gray-400 text-[10px] font-mono font-semibold">
                    {group.items.length} Clip
                  </span>
                </div>

                {/* Subfolder Clips List */}
                {!isCollapsed && (
                  <div className="p-1.5 space-y-1.5">
                    {group.items.length === 0 ? (
                      <p className="text-[10px] text-gray-500 italic p-2 text-center">
                        Tidak ada video dalam subfolder ini
                      </p>
                    ) : (
                      group.items.map((item, idx) => renderClipItem(item, idx + 1))
                    )}
                  </div>
                )}
              </div>
            )
          })}

        {/* Standalone / Manually Added Items */}
        {standalonePlaylist.length > 0 && (
          <div className="bg-[#141824] border border-[#242c42] rounded-lg overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-[#181d2d] flex items-center justify-between border-b border-[#23293d]">
              <span className="font-bold text-xs text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>Media Tambahan (+ Add)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#10131d] text-gray-400 text-[10px] font-mono font-semibold">
                {standalonePlaylist.length} Clip
              </span>
            </div>
            <div className="p-1.5 space-y-1.5">
              {standalonePlaylist.map((item, idx) => renderClipItem(item, idx + 1))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Shortcut Legend */}
      <div className="p-2.5 bg-[#0b0e16] border-t border-[#23293d] shrink-0 text-[10px] text-gray-400 font-mono">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-blue-900/60 text-blue-300 font-bold border border-blue-500/30">F1</span>
            <span>Tarik ke CH A</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/30">F5</span>
            <span>Tarik ke CH B</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-blue-900/60 text-blue-300 font-bold border border-blue-500/30">F2</span>
            <span>Next Item CH A</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/30">F6</span>
            <span>Next Item CH B</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-blue-900/60 text-blue-300 font-bold border border-blue-500/30">F3</span>
            <span>Play/Stop CH A</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/30">F7</span>
            <span>Play/Stop CH B</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold border border-amber-500/30">F4</span>
            <span>Loop CH A</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1 py-0.5 rounded bg-amber-900/60 text-amber-300 font-bold border border-amber-500/30">F8</span>
            <span>Loop CH B</span>
          </div>
        </div>
      </div>
    </div>
  )
}
