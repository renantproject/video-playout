import React from 'react'
import { X, Check, Cpu, Zap, HardDrive, Sliders } from 'lucide-react'
import { EncodingSettings } from '../../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: EncodingSettings
  onSave: (newSettings: EncodingSettings) => void
  isBroadcasting: boolean
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  isBroadcasting
}) => {
  const [formData, setFormData] = React.useState<EncodingSettings>(settings)

  React.useEffect(() => {
    setFormData(settings)
  }, [settings, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#151924] border border-[#262f47] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#262f47] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              SRT Playout & Encoding Engine Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#202738] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {isBroadcasting && (
            <div className="p-3 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-xs">
              Streaming sedang aktif. Perubahan parameter encoder akan berlaku pada sesi broadcast berikutnya.
            </div>
          )}

          {/* Playout Uniform Resolution */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Playout Output Resolution (Normalized)
            </label>
            <select
              value={formData.resolution}
              onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
              className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="1920x1080">1080p (1920x1080) - Broadcast Standard</option>
              <option value="1280x720">720p (1280x720) - Low Bandwidth</option>
              <option value="3840x2160">4K UHD (3840x2160) - High Fidelity</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Semua klip dalam antrean akan di-scale seragam (pad letterbox) agar SRT socket tidak reset saat berganti video.
            </p>
          </div>

          {/* Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Target Framerate (FPS)
              </label>
              <select
                value={formData.fps}
                onChange={(e) => setFormData({ ...formData, fps: parseFloat(e.target.value) })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value={60}>60.00 fps</option>
                <option value={59.94}>59.94 fps (NTSC)</option>
                <option value={50}>50.00 fps (PAL)</option>
                <option value={30}>30.00 fps</option>
                <option value={29.97}>29.97 fps (NTSC)</option>
                <option value={25}>25.00 fps (PAL)</option>
              </select>
            </div>

            {/* Hardware Acceleration */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Hardware Acceleration
              </label>
              <select
                value={formData.hwaccel}
                onChange={(e) => setFormData({ ...formData, hwaccel: e.target.value as any })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="cpu">CPU (libx264 software)</option>
                <option value="nvenc">NVIDIA NVENC (GPU)</option>
                <option value="qsv">Intel QuickSync (QSV)</option>
                <option value="amf">AMD AMF (GPU)</option>
              </select>
            </div>
          </div>

          {/* Bitrates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Video Bitrate (kbps)
              </label>
              <input
                type="number"
                min={500}
                max={50000}
                step={250}
                value={formData.videoBitrate}
                onChange={(e) => setFormData({ ...formData, videoBitrate: parseInt(e.target.value) || 4500 })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Audio Bitrate (kbps)
              </label>
              <select
                value={formData.audioBitrate}
                onChange={(e) => setFormData({ ...formData, audioBitrate: parseInt(e.target.value) || 128 })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value={96}>96 kbps</option>
                <option value={128}>128 kbps (Standard AAC)</option>
                <option value={192}>192 kbps (High Quality)</option>
                <option value={256}>256 kbps (Studio)</option>
                <option value={320}>320 kbps (Lossless tier)</option>
              </select>
            </div>
          </div>

          {/* Preset & GOP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Encoding Preset
              </label>
              <select
                value={formData.preset}
                onChange={(e) => setFormData({ ...formData, preset: e.target.value })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="ultrafast">ultrafast (Lowest CPU)</option>
                <option value="superfast">superfast</option>
                <option value="veryfast">veryfast (Recommended)</option>
                <option value="faster">faster</option>
                <option value="fast">fast</option>
                <option value="medium">medium (High Quality)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                GOP / Keyframe Interval
              </label>
              <input
                type="number"
                min={15}
                max={300}
                value={formData.gopSize}
                onChange={(e) => setFormData({ ...formData, gopSize: parseInt(e.target.value) || 120 })}
                className="w-full bg-[#1b202e] border border-[#2b354f] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[10px] text-gray-400">Default: 120 frames (~2 detik)</span>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-[#262f47] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-semibold text-gray-400 hover:text-white bg-[#1b202e] hover:bg-[#23293b] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center space-x-1.5 shadow-md shadow-blue-600/30 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

