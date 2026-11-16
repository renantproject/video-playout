import React from 'react'

interface AudioPeakMeterProps {
  leftLevel: number // 0 to 1
  rightLevel: number // 0 to 1
  isMuted: boolean
}

export const AudioPeakMeter: React.FC<AudioPeakMeterProps> = ({
  leftLevel,
  rightLevel,
  isMuted
}) => {
  const l = isMuted ? 0 : Math.min(Math.max(leftLevel, 0), 1)
  const r = isMuted ? 0 : Math.min(Math.max(rightLevel, 0), 1)

  // dB calculation: 20 * log10(level)
  const toDb = (lvl: number) => {
    if (lvl <= 0.001) return -60
    return Math.max(-60, Math.round(20 * Math.log10(lvl)))
  }

  const leftDb = toDb(l)
  const rightDb = toDb(r)

  // Calculate percentage height
  const getPercent = (lvl: number) => Math.min(100, Math.round(lvl * 100))

  return (
    <div className="flex flex-col items-center justify-between bg-black/35 backdrop-blur-md border border-white/15 rounded-md p-1.5 text-[9px] text-gray-300 select-none w-11 shrink-0 shadow-xl transition-all">
      <div className="font-mono font-bold text-[8px] text-gray-400/80 mb-0.5">VU</div>

      {/* Meter Bars Container */}
      <div className="flex items-center space-x-1 h-28 relative">
        {/* dB scale labels (Semi-transparent) */}
        <div className="flex flex-col justify-between h-full font-mono text-[7px] text-gray-400/70 pr-0.5 leading-none select-none text-right">
          <span className="text-red-400 font-bold">0</span>
          <span className="text-yellow-400">-6</span>
          <span className="text-yellow-500">-12</span>
          <span className="text-emerald-400">-20</span>
          <span>-40</span>
          <span>-60</span>
        </div>

        {/* Left Channel Bar */}
        <div className="w-2 h-full bg-black/40 rounded-sm overflow-hidden flex flex-col justify-end relative border border-white/10">
          <div
            className="w-full transition-all duration-75 rounded-t-sm"
            style={{
              height: `${getPercent(l)}%`,
              background: 'linear-gradient(to top, #10b981 0%, #10b981 65%, #f59e0b 85%, #ef4444 100%)'
            }}
          />
        </div>

        {/* Right Channel Bar */}
        <div className="w-2 h-full bg-black/40 rounded-sm overflow-hidden flex flex-col justify-end relative border border-white/10">
          <div
            className="w-full transition-all duration-75 rounded-t-sm"
            style={{
              height: `${getPercent(r)}%`,
              background: 'linear-gradient(to top, #10b981 0%, #10b981 65%, #f59e0b 85%, #ef4444 100%)'
            }}
          />
        </div>
      </div>

      {/* L / R Labels */}
      <div className="flex justify-between w-full mt-1.5 font-mono text-[8px] font-bold px-0.5 text-center">
        <span className={leftDb > -6 ? 'text-red-400' : leftDb > -18 ? 'text-yellow-400' : 'text-emerald-400'}>
          L
        </span>
        <span className={rightDb > -6 ? 'text-red-400' : rightDb > -18 ? 'text-yellow-400' : 'text-emerald-400'}>
          R
        </span>
      </div>
      <div className="font-mono text-[7px] text-gray-400/90 mt-0.5 font-semibold">
        {isMuted ? 'MUT' : `${Math.max(leftDb, rightDb)}`}
      </div>
    </div>
  )
}
