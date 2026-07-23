import { useTacticalStore } from '../store/tacticalStore'
import { SST_LEGEND, WAVE_LEGEND } from '../lib/colorScale'

/** 海況模式控制項：海溫/浪高切換 + 色階圖例。 */
export function SeaStateControls() {
  const field = useTacticalStore((s) => s.seaStateField)
  const setField = useTacticalStore((s) => s.setSeaStateField)
  const legend = field === 'sst' ? SST_LEGEND : WAVE_LEGEND

  // 產生色條的漸層
  const steps = 24
  const stops = Array.from({ length: steps }, (_, i) => {
    const v = legend.min + ((legend.max - legend.min) * i) / (steps - 1)
    return legend.colorAt(v)
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-700 p-1">
        <button
          onClick={() => setField('sst')}
          className={`rounded py-1.5 text-xs font-bold transition-all active:scale-95 ${
            field === 'sst' ? 'bg-tactical-cyan/20 text-tactical-cyan' : 'text-slate-400'
          }`}
        >
          🌡️ 海表溫度
        </button>
        <button
          onClick={() => setField('wave')}
          className={`rounded py-1.5 text-xs font-bold transition-all active:scale-95 ${
            field === 'wave' ? 'bg-tactical-cyan/20 text-tactical-cyan' : 'text-slate-400'
          }`}
        >
          〰 浪高
        </button>
      </div>

      {/* 色階圖例 */}
      <div>
        <div
          className="h-3 w-full rounded"
          style={{ background: `linear-gradient(to right, ${stops.join(',')})` }}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
          <span>
            {legend.min}
            {legend.unit}
          </span>
          <span>
            {((legend.min + legend.max) / 2).toFixed(0)}
            {legend.unit}
          </span>
          <span>
            {legend.max}
            {legend.unit}
          </span>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        免金鑰海象資料（Open-Meteo）。點格子看數值；平移地圖會重新載入該區。
      </p>
    </div>
  )
}
