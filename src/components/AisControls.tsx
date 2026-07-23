import { useTacticalStore } from '../store/tacticalStore'
import { isAisConfigured } from '../lib/ais'
import { isSentinelConfigured } from '../lib/sentinel'
import { analyzeVessels } from '../lib/aisAnomaly'

/** AIS 模式控制面板：船舶數、異常警示、衛星船隻疊層（漁火／雷達）。 */
export function AisControls() {
  const vessels = useTacticalStore((s) => s.vessels)
  const showBoatLights = useTacticalStore((s) => s.showBoatLights)
  const setShowBoatLights = useTacticalStore((s) => s.setShowBoatLights)
  const showRadarVessels = useTacticalStore((s) => s.showRadarVessels)
  const setShowRadarVessels = useTacticalStore((s) => s.setShowRadarVessels)
  const analyses = analyzeVessels(vessels)
  const flagged = analyses.filter((a) => a.level !== 'ok')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">🔺 AIS 即時船位（已在圖上）</span>
        <span className="font-mono text-sm font-bold text-tactical-green">{vessels.length}</span>
      </div>

      {flagged.length > 0 && (
        <div className="flex flex-col gap-1 rounded border border-amber-500/40 bg-amber-500/5 p-2">
          <div className="text-[11px] font-semibold text-amber-400">
            ⚠ 異常警示 {flagged.length}
          </div>
          {flagged.slice(0, 5).map((a) => (
            <div key={a.vessel.mmsi} className="flex justify-between gap-2 text-[10px]">
              <span className={a.level === 'alert' ? 'text-tactical-alert' : 'text-amber-400'}>
                {a.vessel.name}
              </span>
              <span className="truncate text-right text-slate-400">{a.alerts.join('、')}</span>
            </div>
          ))}
        </div>
      )}

      {vessels.length === 0 && (
        <p className="text-[10px] leading-relaxed text-amber-500/90">
          {isAisConfigured()
            ? '尚未收到船位——真實 AIS 每艘船隔數十秒才回報一次，請縮小地圖到台灣周邊並稍候。'
            : '模擬船隻在台灣周邊，若看不到請縮小地圖。'}
        </p>
      )}

      {/* 衛星「看不廣播 AIS 的船」疊層 —— 全部畫在同一張地圖，不開網頁 */}
      <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-slate-700 bg-slate-900/40 p-2">
        <div className="text-[11px] font-semibold text-slate-300">🛰️ 外海船隻衛星疊層</div>

        <button
          onClick={() => setShowBoatLights(!showBoatLights)}
          className={[
            'flex items-center justify-between rounded border px-2.5 py-2 text-left text-[11px] font-semibold transition-all active:scale-95',
            showBoatLights
              ? 'border-amber-400 bg-amber-400/15 text-amber-300'
              : 'border-slate-600 bg-slate-900/60 text-slate-300',
          ].join(' ')}
        >
          <span>🌙 夜間漁火（VIIRS · 免金鑰）</span>
          <span className="font-mono">{showBoatLights ? '開' : '關'}</span>
        </button>
        <p className="px-0.5 text-[10px] leading-relaxed text-slate-500">
          夜間外海一顆顆亮點＝開燈作業的漁船／漁船隊。看得到不廣播 AIS 的整支船隊。僅夜間有效。
        </p>

        <button
          onClick={() => setShowRadarVessels(!showRadarVessels)}
          disabled={!isSentinelConfigured()}
          className={[
            'flex items-center justify-between rounded border px-2.5 py-2 text-left text-[11px] font-semibold transition-all active:scale-95',
            !isSentinelConfigured()
              ? 'cursor-not-allowed border-slate-700 bg-slate-900/40 text-slate-600'
              : showRadarVessels
                ? 'border-tactical-cyan bg-tactical-cyan/15 text-tactical-cyan'
                : 'border-slate-600 bg-slate-900/60 text-slate-300',
          ].join(' ')}
        >
          <span>📡 雷達暗船（Sentinel-1）</span>
          <span className="font-mono">
            {!isSentinelConfigured() ? '需金鑰' : showRadarVessels ? '開' : '關'}
          </span>
        </button>
        <p className="px-0.5 text-[10px] leading-relaxed text-slate-500">
          雷達看金屬船身，穿雲、日夜都行。<b className="text-tactical-cyan">雷達有亮點、AIS 卻沒三角形＝可疑暗船</b>（偷渡／關 AIS）。
          {!isSentinelConfigured() && '　⚙️ 設定填 Sentinel 金鑰後啟用。'}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        點船隻可看詳情。無船名／航速異常者以紅色示警。以上皆直接畫在地圖，不需另開 MarineTraffic 網頁。
      </p>
      {!isAisConfigured() && (
        <p className="text-[10px] leading-relaxed text-amber-500/80">
          目前為模擬船隻。到 aisstream.io 免費申請金鑰，填入 ⚙️ 設定即接真實 AIS。
        </p>
      )}
    </div>
  )
}
