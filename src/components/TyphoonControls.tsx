import { demoTyphoon, currentPoint } from '../lib/typhoon'

/**
 * 颱風路徑控制面板：顯示示範颱風的資訊與圖例。
 * 目前無免金鑰即時 CORS 來源（CWA/JTWC 皆未開放），示範資料展示渲染能力；
 * 真實 feed 之後可經 Cloudflare Worker 代理 GDACS/JTWC 後以相同格式餵入。
 */
export function TyphoonControls() {
  const ty = demoTyphoon()
  const cur = currentPoint(ty)
  const future = ty.track.filter((p) => p.hours > 0)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌀</span>
        <div className="flex flex-col">
          <span className="text-base font-bold text-rose-400">
            {ty.name} <span className="text-xs font-normal text-slate-400">DEMO</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {cur.cat}｜近中心風 {cur.windKt} kt｜暴風半徑 {cur.galeRadiusKm} km
          </span>
        </div>
      </div>

      {/* 預報摘要 */}
      <div className="grid grid-cols-3 gap-1.5">
        {future.map((p) => (
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

      {/* 圖例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span>
          <span className="text-rose-400">●</span> 暴風圈
        </span>
        <span>
          <span className="text-rose-400">┄</span> 預報路徑
        </span>
        <span>
          <span className="text-amber-400">◣</span> 潛勢範圍（越遠越寬）
        </span>
      </div>

      <p className="rounded-md bg-slate-800/60 px-2 py-1.5 text-[10px] leading-relaxed text-slate-400">
        目前為<b className="text-slate-300">示範颱風</b>資料。即時 W. Pacific 颱風無免金鑰
        CORS 來源，未來可經 Worker 代理 GDACS/JTWC 即時路徑後，以相同格式自動更新。
      </p>
    </div>
  )
}
