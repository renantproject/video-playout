import React, { useState } from 'react'
import {
  Radio,
  Activity,
  Wifi,
  Shield,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react'
import { SrtConfig, SrtMode, BroadcastTelemetry } from '../../types'

interface SrtBroadcastPanelProps {
  config: SrtConfig
  onChangeConfig: (newConfig: SrtConfig) => void
  telemetry: BroadcastTelemetry
  onStartBroadcast: () => void
  onStopBroadcast: () => void
  isBroadcasting: boolean
}

export const SrtBroadcastPanel: React.FC<SrtBroadcastPanelProps> = ({
  config,
  onChangeConfig,
  telemetry,
  onStartBroadcast,
  onStopBroadcast,
  isBroadcasting
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyReceiverUrl = () => {
    const url = `srt://127.0.0.1:${config.port || 9000}`
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleModeChange = (mode: SrtMode) => {
    onChangeConfig({
      ...config,
      mode
    })
  }

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }

  return (
    <div className="bg-[#12151f] border-t border-[#23293d] p-3 select-none shrink-0">
      {/* Top Bar: SRT Connection Config & Main Broadcast Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode, Host, Port, Latency */}
        <div className="flex items-center space-x-3 flex-wrap">
          {/* Mode Selector */}
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              SRT Mode
            </label>
            <div className="flex rounded bg-[#181d2a] p-0.5 border border-[#262f47]">
              {(['caller', 'listener', 'rendezvous'] as SrtMode[]).map((m) => (
                <button
                  key={m}
                  disabled={isBroadcasting}
                  onClick={() => handleModeChange(m)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded capitalize transition-colors ${
                    config.mode === m
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white disabled:opacity-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Host / IP (only editable in caller/rendezvous mode) */}
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {config.mode === 'listener' ? 'Bind Interface' : 'Target Host / IP'}
            </label>
            <input
              type="text"
              disabled={isBroadcasting || config.mode === 'listener'}
              value={config.mode === 'listener' ? '0.0.0.0 (All interfaces)' : config.host}
              onChange={(e) => onChangeConfig({ ...config, host: e.target.value })}
              placeholder="e.g. 192.168.1.100"
              className="bg-[#181d2a] border border-[#262f47] text-white px-2.5 py-1 rounded text-xs font-mono w-40 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Port */}
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Port
            </label>
            <input
              type="number"
              disabled={isBroadcasting}
              value={config.port}
              onChange={(e) => onChangeConfig({ ...config, port: parseInt(e.target.value) || 9000 })}
              className="bg-[#181d2a] border border-[#262f47] text-white px-2.5 py-1 rounded text-xs font-mono w-20 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Latency Buffer */}
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Latency</span>
              <span className="text-blue-400 font-mono">{config.latency}ms</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min={20}
                max={4000}
                step={20}
                disabled={isBroadcasting}
                value={config.latency}
                onChange={(e) => onChangeConfig({ ...config, latency: parseInt(e.target.value) || 200 })}
                className="w-24 h-1.5 bg-[#262f47] rounded cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#181d2a] border border-[#262f47] self-end mb-0.5"
            title="Toggle Stream ID and Encryption Passphrase"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Security</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Receiver URL Helper (when in Listener mode) */}
        {config.mode === 'listener' && (
          <div className="flex items-center space-x-2 bg-[#181d2a] px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs">
            <span className="text-[10px] text-gray-400 uppercase font-sans font-semibold">URL Player (VLC / OBS):</span>
            <span className="font-mono font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/5 select-all">
              srt://127.0.0.1:{config.port || 9000}
            </span>
            <button
              onClick={handleCopyReceiverUrl}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 transition-colors"
              title="Salin URL SRT ke Clipboard"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="text-[10px]">{isCopied ? 'Tersalin!' : 'Salin URL'}</span>
            </button>
            <span className="text-[10px] text-gray-500 hidden xl:inline">*(Gunakan 127.0.0.1, bukan localhost)*</span>
          </div>
        )}

        {/* Right: Broadcast Trigger Button */}
        <div className="flex items-center space-x-3">
          {isBroadcasting ? (
            <button
              onClick={onStopBroadcast}
              className="px-6 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-red-600/30 transition-all border border-red-400"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>STOP BROADCAST</span>
            </button>
          ) : (
            <button
              onClick={onStartBroadcast}
              className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all border border-blue-400"
            >
              <Radio className="w-4 h-4 text-white" />
              <span>START BROADCAST</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Security Drawer */}
      {showAdvanced && (
        <div className="mt-2.5 pt-2 border-t border-[#23293d] flex items-center space-x-4 bg-[#0e1118] p-2 rounded">
          <div className="flex items-center space-x-2">
            <label className="text-[10px] text-gray-400 font-medium">Stream ID:</label>
            <input
              type="text"
              disabled={isBroadcasting}
              value={config.streamId || ''}
              onChange={(e) => onChangeConfig({ ...config, streamId: e.target.value })}
              placeholder="e.g. live/stream1"
              className="bg-[#181d2a] border border-[#262f47] text-white px-2 py-0.5 rounded text-xs font-mono w-44 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-[10px] text-gray-400 font-medium">Passphrase (AES):</label>
            <input
              type="password"
              disabled={isBroadcasting}
              value={config.passphrase || ''}
              onChange={(e) => onChangeConfig({ ...config, passphrase: e.target.value })}
              placeholder="10-79 chars"
              className="bg-[#181d2a] border border-[#262f47] text-white px-2 py-0.5 rounded text-xs font-mono w-44 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>
      )}

      {/* Telemetry Bar (FR-3.4) */}
      <div className="mt-3 pt-2.5 border-t border-[#23293d] flex items-center justify-between text-xs font-mono text-gray-300">
        <div className="flex items-center space-x-5">
          {/* Status */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">Status:</span>
            {telemetry.status === 'LIVE' ? (
              <span className="text-red-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
                <span>LIVE</span>
              </span>
            ) : telemetry.status === 'LISTENING' ? (
              <span className="text-blue-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>LISTENING (MENUNGGU PENERIMA)</span>
              </span>
            ) : telemetry.status === 'CONNECTING' ? (
              <span className="text-amber-400 font-bold">CONNECTING</span>
            ) : telemetry.status === 'RECONNECTING' ? (
              <span className="text-orange-400 font-bold">RETRYING</span>
            ) : telemetry.status === 'ERROR' ? (
              <span className="text-red-400 font-bold">ERROR</span>
            ) : (
              <span className="text-gray-400">IDLE</span>
            )}
          </div>

          {/* Bitrate */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">Bitrate:</span>
            <span className="text-blue-400 font-bold">
              {telemetry.bitrateKbps ? `${telemetry.bitrateKbps} kbps` : '0 kbps'}
            </span>
          </div>

          {/* FPS */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">Stream FPS:</span>
            <span className="text-emerald-400 font-bold">
              {telemetry.fps ? `${telemetry.fps}` : '0'}
            </span>
          </div>

          {/* Drops */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">Drop Frames:</span>
            <span className={telemetry.dropFrames > 0 ? 'text-red-400 font-bold' : 'text-gray-300'}>
              {telemetry.dropFrames}
            </span>
          </div>

          {/* RTT */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">RTT:</span>
            <span className="text-purple-400 font-bold">{telemetry.rttMs || 12} ms</span>
          </div>

          {/* Buffer Health */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-sans uppercase">Buffer:</span>
            <span className="text-emerald-400 font-bold">{telemetry.bufferHealth}%</span>
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center space-x-2 text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Uptime: {formatUptime(telemetry.uptime)}</span>
        </div>
      </div>

      {/* Error Banner */}
      {telemetry.errorMessage && (
        <div className="mt-2 p-2 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="truncate">{telemetry.errorMessage}</span>
        </div>
      )}
    </div>
  )
}

