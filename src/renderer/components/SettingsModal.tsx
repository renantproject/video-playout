import React, { useState, useEffect } from 'react'
import {
  X,
  Sliders,
  Radio,
  Copy,
  Check,
  Layers
} from 'lucide-react'
import { EncodingSettings, SrtConfig, SrtMode } from '../../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  srtConfigA: SrtConfig
  onSaveSrtConfigA: (newConfig: SrtConfig) => void
  srtConfigB: SrtConfig
  onSaveSrtConfigB: (newConfig: SrtConfig) => void
  encodingSettings: EncodingSettings
  onSaveEncodingSettings: (newSettings: EncodingSettings) => void
  isBroadcastingA: boolean
  isBroadcastingB: boolean
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  srtConfigA,
  onSaveSrtConfigA,
  srtConfigB,
  onSaveSrtConfigB,
  encodingSettings,
  onSaveEncodingSettings,
  isBroadcastingA,
  isBroadcastingB
}) => {
  const [activeTab, setActiveTab] = useState<'srtA' | 'srtB' | 'encoding'>('srtA')

  // Local Form States
  const [srtDataA, setSrtDataA] = useState<SrtConfig>(srtConfigA)
  const [srtDataB, setSrtDataB] = useState<SrtConfig>(srtConfigB)
  const [encData, setEncData] = useState<EncodingSettings>(encodingSettings)
  const [isCopiedA, setIsCopiedA] = useState(false)
  const [isCopiedB, setIsCopiedB] = useState(false)

  useEffect(() => {
    setSrtDataA(srtConfigA)
    setSrtDataB(srtConfigB)
    setEncData(encodingSettings)
  }, [srtConfigA, srtConfigB, encodingSettings, isOpen])

  if (!isOpen) return null

  const handleCopyReceiverUrlA = () => {
    const url = `srt://127.0.0.1:${srtDataA.port || 9000}`
    navigator.clipboard.writeText(url)
    setIsCopiedA(true)
    setTimeout(() => setIsCopiedA(false), 2000)
  }

  const handleCopyReceiverUrlB = () => {
    const url = `srt://127.0.0.1:${srtDataB.port || 9001}`
    navigator.clipboard.writeText(url)
    setIsCopiedB(true)
    setTimeout(() => setIsCopiedB(false), 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSaveSrtConfigA(srtDataA)
    onSaveSrtConfigB(srtDataB)
    onSaveEncodingSettings(encData)
    onClose()
  }

  const renderSrtConfigForm = (
    channel: 'A' | 'B',
    data: SrtConfig,
    setData: React.Dispatch<React.SetStateAction<SrtConfig>>,
    isBroadcasting: boolean,
    isCopied: boolean,
    onCopy: () => void
  ) => {
    const isChannelA = channel === 'A'
    const themeColor = isChannelA ? 'blue' : 'emerald'

    return (
      <div className="space-y-4 text-xs">
        {/* Banner */}
        <div
          className={`p-2.5 rounded border flex items-center justify-between ${
            isChannelA
              ? 'bg-blue-950/30 border-blue-800/40 text-blue-300'
              : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isChannelA ? 'bg-blue-400' : 'bg-emerald-400'
              }`}
            />
            <span className="font-bold tracking-wide">
              Koneksi Output SRT - CHANNEL {channel}
            </span>
          </div>
          <span className="font-mono text-[11px] font-semibold bg-black/40 px-2 py-0.5 rounded">
            Target Port: {data.port}
          </span>
        </div>

        {/* SRT Mode Selector */}
        <div>
          <label className="text-gray-300 font-semibold block mb-1">Mode SRT</label>
          <div className="grid grid-cols-3 gap-2">
            {(['listener', 'caller', 'rendezvous'] as SrtMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={isBroadcasting}
                onClick={() => setData({ ...data, mode: m })}
                className={`py-2 px-3 rounded font-bold capitalize border text-center transition-all ${
                  data.mode === m
                    ? themeColor === 'blue'
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                      : 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                    : 'bg-[#181e2b] text-gray-400 border-[#263148] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {data.mode === 'listener'
              ? 'Listener: PlayoutStream membuka port dan menunggu receiver (VLC / OBS / vMix) terhubung.'
              : data.mode === 'caller'
              ? 'Caller: PlayoutStream mengirim siaran langsung ke IP & port server/komputer penerima.'
              : 'Rendezvous: Kedua pihak saling terhubung melalui NAT traversal.'}
          </p>
        </div>

        {/* Host & Port */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              {data.mode === 'listener' ? 'Bind Interface' : 'Target Host / IP'}
            </label>
            <input
              type="text"
              disabled={isBroadcasting || data.mode === 'listener'}
              value={data.mode === 'listener' ? '0.0.0.0 (Semua Interface)' : data.host}
              onChange={(e) => setData({ ...data, host: e.target.value })}
              className="w-full bg-[#181e2b] border border-[#2b374e] text-white px-3 py-2 rounded font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              Port SRT Channel {channel}
            </label>
            <input
              type="number"
              disabled={isBroadcasting}
              value={data.port}
              onChange={(e) =>
                setData({ ...data, port: parseInt(e.target.value, 10) || (isChannelA ? 9000 : 9001) })
              }
              className={`w-full bg-[#181e2b] border text-white px-3 py-2 rounded font-mono focus:outline-none ${
                isChannelA
                  ? 'border-blue-500/50 focus:border-blue-400'
                  : 'border-emerald-500/50 focus:border-emerald-400'
              }`}
            />
          </div>
        </div>

        {/* Latency / Delay Buffer */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-gray-300 font-semibold">Latency Buffer (Delay)</label>
            <span
              className={`font-mono font-bold ${
                isChannelA ? 'text-blue-400' : 'text-emerald-400'
              }`}
            >
              {data.latency} ms
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={4000}
            step={20}
            disabled={isBroadcasting}
            value={data.latency}
            onChange={(e) => setData({ ...data, latency: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-[#202738] rounded-lg cursor-pointer appearance-none"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
            <span>20 ms (Ultra Low Latency LAN)</span>
            <span>200 ms (Default)</span>
            <span>2000 ms (Internet Stabil)</span>
          </div>
        </div>

        {/* If Listener Mode: Copy Receiver URL Helper */}
        {data.mode === 'listener' && (
          <div
            className={`p-3 bg-[#111622] rounded-lg border ${
              isChannelA ? 'border-blue-900/40' : 'border-emerald-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[11px] font-bold ${
                  isChannelA ? 'text-blue-400' : 'text-emerald-400'
                }`}
              >
                URL Penerima VLC / OBS / vMix untuk Channel {channel}:
              </span>
              <button
                type="button"
                onClick={onCopy}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  isChannelA
                    ? 'bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border-blue-500/40'
                    : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border-emerald-500/40'
                }`}
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin URL'}</span>
              </button>
            </div>
            <code
              className={`text-xs font-mono bg-black/60 px-2 py-1 rounded block select-all ${
                isChannelA ? 'text-blue-300' : 'text-emerald-300'
              }`}
            >
              srt://127.0.0.1:{data.port || (isChannelA ? 9000 : 9001)}
            </code>
          </div>
        )}

        {/* Security / Encryption (Optional) */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#232b3d]">
          <div>
            <label className="text-gray-300 font-semibold block mb-1">Stream ID (Opsional)</label>
            <input
              type="text"
              disabled={isBroadcasting}
              value={data.streamId || ''}
              onChange={(e) => setData({ ...data, streamId: e.target.value })}
              placeholder={isChannelA ? 'misal: live/channelA' : 'misal: live/channelB'}
              className="w-full bg-[#181e2b] border border-[#2b374e] text-white px-3 py-2 rounded font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-gray-300 font-semibold block mb-1">Passphrase / Sandi (Opsional)</label>
            <input
              type="password"
              disabled={isBroadcasting}
              value={data.passphrase || ''}
              onChange={(e) => setData({ ...data, passphrase: e.target.value })}
              placeholder="Minimal 10 karakter"
              className="w-full bg-[#181e2b] border border-[#2b374e] text-white px-3 py-2 rounded font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#131722] border border-[#263147] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#232b3d] flex items-center justify-between bg-[#0e111a]">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Pengaturan Dual Broadcast SRT & Output
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#202738] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#232b3d] bg-[#10141f] px-5 pt-2">
          {/* Tab Channel A */}
          <button
            type="button"
            onClick={() => setActiveTab('srtA')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'srtA'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Channel A (Port {srtDataA.port || 9000})</span>
          </button>

          {/* Tab Channel B */}
          <button
            type="button"
            onClick={() => setActiveTab('srtB')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'srtB'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Channel B (Port {srtDataB.port || 9001})</span>
          </button>

          {/* Tab Format Video & Audio */}
          <button
            type="button"
            onClick={() => setActiveTab('encoding')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'encoding'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Format Video & Audio</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {(isBroadcastingA || isBroadcastingB) && (
            <div className="p-3 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-xs">
              Broadcast sedang aktif. Parameter koneksi dan resolusi akan diterapkan pada sesi broadcast berikutnya.
            </div>
          )}

          {activeTab === 'srtA' &&
            renderSrtConfigForm('A', srtDataA, setSrtDataA, isBroadcastingA, isCopiedA, handleCopyReceiverUrlA)}

          {activeTab === 'srtB' &&
            renderSrtConfigForm('B', srtDataB, setSrtDataB, isBroadcastingB, isCopiedB, handleCopyReceiverUrlB)}

          {activeTab === 'encoding' && (
            <div className="space-y-4 text-xs">
              {/* Broadcast CBR Callout */}
              <div className="p-3 bg-blue-950/40 rounded-lg border border-blue-800/60 text-blue-200 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-blue-300">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Kunci Encoder ke Mode CBR (Constant Bitrate)</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Kunci bitrate di angka tinggi (<b>25 – 50 Mbps</b> untuk 1080p) dan matikan fitur adaptive bitrate (ABR) serta lookahead buffer dengan mode <i>Zero Latency</i> agar siaran SRT stabil, tidak patah-patah, dan kualitas gambar konsisten.
                </p>
              </div>

              {/* Rate Control: CBR vs VBR */}
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Mode Rate Control</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEncData({ ...encData, rateControl: 'CBR' })}
                    className={`py-2 px-3 rounded font-bold border text-center transition-all ${
                      (encData.rateControl ?? 'CBR') === 'CBR'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                        : 'bg-[#181e2b] text-gray-400 border-[#263148] hover:text-white'
                    }`}
                  >
                    CBR (Constant Bitrate - Direkomendasikan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEncData({ ...encData, rateControl: 'VBR' })}
                    className={`py-2 px-3 rounded font-bold border text-center transition-all ${
                      encData.rateControl === 'VBR'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                        : 'bg-[#181e2b] text-gray-400 border-[#263148] hover:text-white'
                    }`}
                  >
                    VBR (Variable Bitrate)
                  </button>
                </div>
              </div>

              {/* Video Bitrate with Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 font-semibold">Video Bitrate</label>
                  <span className="font-mono text-blue-400 font-bold">
                    {(encData.videoBitrate / 1000).toFixed(1)} Mbps ({encData.videoBitrate} kbps)
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: '15 Mbps', val: 15000 },
                    { label: '25 Mbps (Master)', val: 25000 },
                    { label: '35 Mbps', val: 35000 },
                    { label: '50 Mbps (Ultra)', val: 50000 }
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setEncData({ ...encData, videoBitrate: p.val })}
                      className={`py-1 px-2 rounded text-[11px] font-mono border transition-all ${
                        encData.videoBitrate === p.val
                          ? 'bg-blue-600 text-white border-blue-400 font-bold'
                          : 'bg-[#161b27] text-gray-400 border-[#253046] hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  step={1000}
                  min={1000}
                  max={80000}
                  value={encData.videoBitrate}
                  onChange={(e) => setEncData({ ...encData, videoBitrate: parseInt(e.target.value, 10) || 25000 })}
                  className="w-full bg-[#181e2b] border border-[#2b374e] text-white px-3 py-2 rounded font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Output Resolution & FPS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">
                    Format Resolusi Output
                  </label>
                  <select
                    value={encData.resolution}
                    onChange={(e) => setEncData({ ...encData, resolution: e.target.value })}
                    className="w-full bg-[#181e2b] border border-[#2b374e] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="1920x1080">1080p (1920x1080) - Standar Broadcast</option>
                    <option value="1280x720">720p (1280x720) - Low Bitrate</option>
                    <option value="3840x2160">4K UHD (3840x2160) - 4K Master</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Target Framerate (FPS)</label>
                  <select
                    value={encData.fps}
                    onChange={(e) => setEncData({ ...encData, fps: parseFloat(e.target.value) })}
                    className="w-full bg-[#181e2b] border border-[#2b374e] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value={25}>25.00 fps (PAL Indonesia Broadcast)</option>
                    <option value={50}>50.00 fps (Broadcast PAL 50p)</option>
                    <option value={60}>60.00 fps (60p)</option>
                    <option value={59.94}>59.94 fps (Broadcast NTSC)</option>
                    <option value={30}>30.00 fps</option>
                  </select>
                </div>
              </div>

              {/* Hardware Acceleration & Audio Bitrate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Hardware Acceleration</label>
                  <select
                    value={encData.hwaccel}
                    onChange={(e) => setEncData({ ...encData, hwaccel: e.target.value as any })}
                    className="w-full bg-[#181e2b] border border-[#2b374e] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="cpu">CPU (libx264 Ultrafast ZeroLatency)</option>
                    <option value="nvenc">NVIDIA NVENC (GPU Hardware)</option>
                    <option value="qsv">Intel QuickSync (QSV)</option>
                    <option value="amf">AMD AMF</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Audio Bitrate (kbps)</label>
                  <select
                    value={encData.audioBitrate}
                    onChange={(e) => setEncData({ ...encData, audioBitrate: parseInt(e.target.value, 10) || 192 })}
                    className="w-full bg-[#181e2b] border border-[#2b374e] rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value={192}>192 kbps (Broadcast Quality AAC)</option>
                    <option value={256}>256 kbps (Studio Quality)</option>
                    <option value={320}>320 kbps (Maximum AAC)</option>
                    <option value={128}>128 kbps (Standard AAC)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Buttons */}
          <div className="pt-4 border-t border-[#232b3d] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#1e2436] hover:bg-[#28324a] text-gray-300 text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-colors"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
