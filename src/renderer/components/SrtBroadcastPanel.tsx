import React from 'react'
import { Radio, Settings, Square, AlertCircle } from 'lucide-react'
import { BroadcastTelemetry, SrtConfig } from '../../types'

interface SrtBroadcastPanelProps {
  configA: SrtConfig
  configB: SrtConfig
  telemetryA: BroadcastTelemetry
  telemetryB: BroadcastTelemetry
  onStartBroadcastA: () => void
  onStopBroadcastA: () => void
  isBroadcastingA: boolean
  onStartBroadcastB: () => void
  onStopBroadcastB: () => void
  isBroadcastingB: boolean
  onStartAll: () => void
  onStopAll: () => void
  onOpenSettings: () => void
}

export const SrtBroadcastPanel: React.FC<SrtBroadcastPanelProps> = ({
  configA,
  configB,
  telemetryA,
  telemetryB,
  onStartBroadcastA,
  onStopBroadcastA,
  isBroadcastingA,
  onStartBroadcastB,
  onStopBroadcastB,
  isBroadcastingB,
  onStartAll,
  onStopAll,
  onOpenSettings
}) => {
  const isAnyBroadcasting = isBroadcastingA || isBroadcastingB
  const isBothBroadcasting = isBroadcastingA && isBroadcastingB

  const renderStatusPill = (
    channel: 'A' | 'B',
    telemetry: BroadcastTelemetry,
    config: SrtConfig
  ) => {
    const isChannelA = channel === 'A'

    if (telemetry.status === 'LIVE') {
      return (
        <div className="flex items-center space-x-1.5 text-red-400 bg-red-950/50 border border-red-700/60 px-2 py-1 rounded text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold">LIVE ({config.port})</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-200">{telemetry.bitrateKbps}k</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-200">{telemetry.fps}fps</span>
        </div>
      )
    }

    if (telemetry.status === 'LISTENING') {
      return (
        <div
          className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-mono border ${
            isChannelA
              ? 'text-blue-400 bg-blue-950/40 border-blue-800/50'
              : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              isChannelA ? 'bg-blue-400' : 'bg-emerald-400'
            }`}
          />
          <span className="font-bold">LISTENING (Port: {config.port})</span>
        </div>
      )
    }

    if (telemetry.status === 'CONNECTING') {
      return (
        <div className="flex items-center space-x-1.5 text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-1 rounded text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>CONNECTING ({config.port})...</span>
        </div>
      )
    }

    if (telemetry.status === 'ERROR') {
      return (
        <div className="flex items-center space-x-1.5 text-red-400 bg-red-950/40 border border-red-800/50 px-2 py-1 rounded text-[11px] font-mono">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>ERROR ({config.port})</span>
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-1.5 text-gray-400 bg-[#141824] px-2 py-1 rounded border border-[#202738] text-[11px] font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        <span>STANDBY ({config.port})</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0e111a] border-t border-[#1e2536] px-3.5 py-2 flex items-center justify-between select-none shrink-0 gap-3">
      {/* Dual Stream Feeds: Channel A (Left) and Channel B (Right) */}
      <div className="flex items-center space-x-3 flex-1 min-w-0 overflow-x-auto">
        {/* === CHANNEL A STREAM CONTROLS === */}
        <div className="flex items-center space-x-2 bg-[#121622] p-1.5 rounded-lg border border-blue-900/40 shrink-0">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/50">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[11px] font-black text-blue-300 tracking-wider">CH A</span>
          </div>

          {renderStatusPill('A', telemetryA, configA)}

          <button
            type="button"
            onClick={isBroadcastingA ? onStopBroadcastA : onStartBroadcastA}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-[11px] font-bold tracking-wider transition-all shadow ${
              isBroadcastingA
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
            title={isBroadcastingA ? 'Hentikan stream Channel A' : `Mulai stream Channel A di Port ${configA.port}`}
          >
            {isBroadcastingA ? (
              <>
                <Square className="w-3 h-3 fill-white" />
                <span>STOP A</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3" />
                <span>STREAM A</span>
              </>
            )}
          </button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-[#232b3d] shrink-0" />

        {/* === CHANNEL B STREAM CONTROLS === */}
        <div className="flex items-center space-x-2 bg-[#121622] p-1.5 rounded-lg border border-emerald-900/40 shrink-0">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-black text-emerald-300 tracking-wider">CH B</span>
          </div>

          {renderStatusPill('B', telemetryB, configB)}

          <button
            type="button"
            onClick={isBroadcastingB ? onStopBroadcastB : onStartBroadcastB}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-[11px] font-bold tracking-wider transition-all shadow ${
              isBroadcastingB
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
            title={isBroadcastingB ? 'Hentikan stream Channel B' : `Mulai stream Channel B di Port ${configB.port}`}
          >
            {isBroadcastingB ? (
              <>
                <Square className="w-3 h-3 fill-white" />
                <span>STOP B</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3" />
                <span>STREAM B</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Far Right: Master All Broadcast & Settings Gear */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Broadcast All / Stop All Button */}
        <button
          type="button"
          onClick={isAnyBroadcasting ? onStopAll : onStartAll}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg transition-all ${
            isBothBroadcasting
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
              : isAnyBroadcasting
              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/30'
              : 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-blue-600/20'
          }`}
          title="Mulai atau hentikan siaran kedua channel (A: 9000 & B: 9001) secara bersamaan"
        >
          {isAnyBroadcasting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>STOP ALL</span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>STREAM ALL (A+B)</span>
            </>
          )}
        </button>

        {/* Gear Icon for SRT & Encoder Configuration */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-[#181d2c] hover:bg-[#232c42] text-gray-300 hover:text-white border border-[#2b354d] transition-all hover:rotate-45"
          title="Pengaturan Port & Parameter SRT Channel A (9000) dan Channel B (9001)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
