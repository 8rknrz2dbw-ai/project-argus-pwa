import { useTacticalStore } from '../store/tacticalStore'
import { isSentinelConfigured } from '../lib/sentinel'

/**
 * 光學模式的控制項：影像來源提示 + 雲量滑桿 + 歷史觀測日期。
 * 只在 optical 模式顯示，避免 UI 雜亂。
 */
export function OpticalControls() {
  const maxCloudCover = useTacticalStore((s) => s.maxCloudCover)
  const setMaxCloudCover = useTacticalStore((s) => s.setMaxCloudCover)
  const observationDate = useTacticalStore((s) => s.observationDate)
  const setObservationDate = useTacticalStore((s) => s.setObservationDate)
  const today = new Date().toISOString().slice(0, 10)
  const hd = isSentinelConfigured()

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/80 p-3">
      <div className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-[11px] leading-relaxed">
        {hd ? (
          <span className="text-tactical-green">🛰️ 高解析度：Sentinel-2（10m）· 雲量過濾生效</span>
        ) : (
          <span className="text-tactical-cyan">
            🛰️ 免費衛星影像：NASA MODIS（約 250m）· 貼 Sentinel 金鑰可升級 10m
          </span>
        )}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-tactical-green">☁ 最大雲量</label>
          <span className="font-mono text-sm text-tactical-cyan">{maxCloudCover}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={maxCloudCover}
          onChange={(e) => setMaxCloudCover(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <p className="mt-1 text-[10px] text-slate-500">
          {hd ? '交給 ESA 伺服器過濾（MAXCC 參數）' : '雲量過濾需 Sentinel 金鑰；NASA 免費影像為每日合成'}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-tactical-green">
          📅 觀測日期
        </label>
        <input
          type="date"
          max={today}
          value={observationDate}
          onChange={(e) => setObservationDate(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-200"
        />
      </div>
    </div>
  )
}
