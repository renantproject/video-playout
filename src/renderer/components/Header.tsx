import React from 'react'
import { Radio, Settings, Monitor, HelpCircle, HardDriveDownload } from 'lucide-react'
import { BroadcastStatus } from '../../types'

interface HeaderProps {
  broadcastStatus: BroadcastStatus
  onOpenSettings: () => void
  onToggleSecondary: () => void
  isSecondaryActive: boolean
  onOpenHelp: () => void
}

export const Header: React.FC<HeaderProps> = ({
  broadcastStatus,
  onOpenSettings,
  onToggleSecondary,
  isSecondaryActive,
  onOpenHelp
}) => {
  return (
    <header className="h-12 bg-[#12151f] border-b border-[#23293d] flex items-center justify-between px-4 select-none shrink-0">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wide text-sm text-gray-100">PlayoutStream</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1e2538] text-blue-400 border border-blue-900/40">
                SRT Playout MCR
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Status Banner */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 px-3 py-1 bg-[#1a1f2e] border border-[#262f47] rounded-full text-xs">
          <span className="text-gray-400 font-medium">SRT Engine:</span>
          {broadcastStatus === 'LIVE' && (
            <span className="flex items-center space-x-1.5 text-red-400 font-bold tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-live-pulse" />
              <span>LIVE ON AIR</span>
            </span>
          )}
          {broadcastStatus === 'LISTENING' && (
            <span className="flex items-center space-x-1.5 text-blue-400 font-bold tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>LISTENING (WAITING FOR RECEIVER)</span>
            </span>
          )}
          {broadcastStatus === 'CONNECTING' && (
            <span className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>CONNECTING...</span>
            </span>
          )}
          {broadcastStatus === 'RECONNECTING' && (
            <span className="flex items-center space-x-1.5 text-orange-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span>RECONNECTING...</span>
            </span>
          )}
          {broadcastStatus === 'ERROR' && (
            <span className="flex items-center space-x-1 text-red-400 font-medium">
              <span>● ERROR</span>
            </span>
          )}
          {broadcastStatus === 'IDLE' && (
            <span className="flex items-center space-x-1 text-gray-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span>STANDBY / IDLE</span>
            </span>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleSecondary}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
            isSecondaryActive
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/20'
              : 'bg-[#1a1f2e] text-gray-300 border-[#262f47] hover:bg-[#252d42] hover:text-white'
          }`}
          title="Open or Close Secondary Monitor Auxiliary Output"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Aux Monitor</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#1a1f2e] text-gray-300 border border-[#262f47] hover:bg-[#252d42] hover:text-white transition-colors"
          title="Broadcast & Encoder Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Encoder Setup</span>
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-[#1e2538] transition-colors"
          title="Workflow Guide & Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

