import { demoTyphoon, currentPoint } from '../lib/typhoon'
import { isCwaConfigured } from '../lib/config'
import { estimateWarnings } from '../lib/typhoonWarning'
import { useTacticalStore } from '../store/tacticalStore'

/**
 * 颱風路徑控制面板：顯示目前颱風（CWA/GDACS/示範）的資訊、預報摘要、
 * 以及依路徑推估的海警/陸警最快時機。
 */
export function TyphoonControls() {
  const active = useTacticalStore((s) => s.activeTyphoon)
  const ty = active ?? demoTyphoon()
  const cur = currentPoint(ty)
  const future = ty.track.filter((p) => p.hours > 0)
  const cwa = isCwaConfigured()
  const warn = estimateWarnings(ty)

  const now = Date.now()
  const etaText = (h: number | null) => {
    if (h === null) return '推估不直接影響'
    if (h <= 0) return '⚠ 已影響中'
    const d = new Date(now + h * 3600000)
    const clock = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
    return `最快 +${h}h（約 ${clock}）`
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌀</span>
        <div className="flex flex-col">
          <span className="text-base font-bold text-rose-400">
            {ty.name}{' '}
            <span className="text-xs font-normal text-slate-400">{ty.demo ? 'DEMO' : ty.nameEn}</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {cur.cat}｜近中心風 {cur.windKt} kt｜暴風半徑 {cur.galeRadiusKm} km
          </span>
        </div>
      </div>

      {/* 警報推估（海警/陸警最快時機）*/}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
        <div className="mb-1 text-[11px] font-semibold text-amber-400">⚠ 對台灣影響推估（依路徑）</div>
        <div className="flex flex-col gap-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-sky-300">🌊 海上警報</span>
            <span className={`font-mono ${warn.seaHours != null ? 'text-sky-200' : 'text-slate-500'}`}>
              {etaText(warn.seaHours)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-300">🏝 陸上警報</span>
            <span className={`font-mono ${warn.landHours != null ? 'text-rose-200' : 'text-slate-500'}`}>
              {etaText(warn.landHours)}
            </span>
          </div>
          <div className="mt-0.5 text-[9px] text-slate-500">
            暴風圈邊緣距海岸最近約 {Math.round(warn.closestGapKm)} km｜推估非官方，以中央氣象署發布為準
          </div>
        </div>
      </div>

      {/* 預報摘要 */}
      {future.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {future.slice(0, 6).map((p) => (
            <div
              key={p.hours}
              className="flex flex-col items-center rounded-md border border-rose-500/30 bg-rose-500/5 px-1 py-1.5"
            >
              <span className="font-mono text-xs font-bold text-rose-300">+{p.hours}h</span>
              <span className="text-[10px] text-slate-400">{p.windKt} kt</span>
              <span className="text-[9px] text-slate-500">{p.galeRadiusKm} km</span>
            </div>
          ))}
        </div>
      )}

      {ty.demo ? (
        <p className="rounded-md bg-slate-800/60 px-2 py-1.5 text-[10px] leading-relaxed text-slate-400">
          目前顯示<b className="text-slate-300">示範颱風</b>（GDACS 免金鑰查無活躍颱風，或解析失敗）。
          要接<b className="text-slate-300">中央氣象署官方路徑＋暴風半徑</b>最準：⚙️ 設定填「Worker 網址」+「CWA 授權碼」，並重新部署 worker.js。
        </p>
      ) : (
        <p className="rounded-md border border-tactical-green/30 bg-tactical-green/5 px-2 py-1.5 text-[10px] leading-relaxed text-tactical-green">
          ✓ 即時颱風資料：{cwa ? '中央氣象署 (CWA)' : 'GDACS 免金鑰'}。
          {!cwa && ' 想要完整預報路徑與官方警報，建議設定 CWA。'}
        </p>
      )}
    </div>
  )
}
