import React from 'react'
import { Radio, HelpCircle, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { BroadcastStatus } from '../../types'

interface HeaderProps {
  broadcastStatusA: BroadcastStatus
  broadcastStatusB: BroadcastStatus
  portA: number
  portB: number
  proxyQueueStatus?: {
    total: number
    pending: number
    active: number
    completed: number
    currentFile: string
  }
  onOpenHelp: () => void
  onOpenLog?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  broadcastStatusA,
  broadcastStatusB,
  portA,
  portB,
  proxyQueueStatus,
  onOpenHelp,
  onOpenLog
}) => {
  const isLiveA = broadcastStatusA === 'LIVE'
  const isLiveB = broadcastStatusB === 'LIVE'
  const isProxying = proxyQueueStatus && (proxyQueueStatus.active > 0 || proxyQueueStatus.pending > 0)

  return (
    <header className="h-11 bg-[#10131d] border-b border-[#202738] flex items-center justify-between px-4 select-none shrink-0">
      {/* Brand & Title */}
      <div className="flex items-center space-x-2.5">
        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
          <Radio className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-bold tracking-wide text-sm text-gray-100">PlayoutStream</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#182030] text-blue-400 border border-blue-900/40">
            Dual Channel Playout
          </span>
        </div>
      </div>

      {/* Center Dual SRT Status Banners & Proxy Progress */}
      <div className="flex items-center space-x-2.5">
        {/* Background Proxy Queue Indicator */}
        {isProxying && (
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-amber-950/40 border border-amber-600/40 rounded-full text-[11px] font-mono text-amber-300 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            <span>
              Proxy: {proxyQueueStatus.completed}/{proxyQueueStatus.total} ({proxyQueueStatus.currentFile.slice(0, 16)}...)
            </span>
          </div>
        )}

        {/* Channel A SRT Engine Status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-[#161a26] border border-[#232a3d] rounded-full text-xs font-mono">
          <span className="text-blue-400 font-bold">CH A ({portA}):</span>
          {isLiveA ? (
            <span className="flex items-center space-x-1 text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE</span>
            </span>
          ) : broadcastStatusA === 'LISTENING' ? (
            <span className="flex items-center space-x-1 text-blue-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>LISTEN</span>
            </span>
          ) : broadcastStatusA === 'CONNECTING' ? (
            <span className="text-amber-400">CONN...</span>
          ) : broadcastStatusA === 'ERROR' ? (
            <span className="text-red-400">ERROR</span>
          ) : (
            <span className="text-gray-400">STANDBY</span>
          )}
        </div>

        {/* Channel B SRT Engine Status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-[#161a26] border border-[#232a3d] rounded-full text-xs font-mono">
          <span className="text-emerald-400 font-bold">CH B ({portB}):</span>
          {isLiveB ? (
            <span className="flex items-center space-x-1 text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE</span>
            </span>
          ) : broadcastStatusB === 'LISTENING' ? (
            <span className="flex items-center space-x-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LISTEN</span>
            </span>
          ) : broadcastStatusB === 'CONNECTING' ? (
            <span className="text-amber-400">CONN...</span>
          ) : broadcastStatusB === 'ERROR' ? (
            <span className="text-red-400">ERROR</span>
          ) : (
            <span className="text-gray-400">STANDBY</span>
          )}
        </div>
      </div>

      {/* Right: Open Activity Log & Help */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenLog}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#161c28] hover:bg-[#1e2738] text-gray-300 hover:text-white border border-[#2b374e] text-xs font-medium transition-colors"
          title="Buka File Log Aktivitas (playout_activity.log)"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Buka Log</span>
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
          title="Panduan Keyboard Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
