import { currentPoint } from '../lib/typhoon'
import { isCwaConfigured } from '../lib/config'
import { estimateWarnings, coastGuardVerdict } from '../lib/typhoonWarning'
import { typhoonBrief } from '../lib/typhoonBrief'
import { interpTyphoonAt } from '../map/TyphoonLayer'
import { fmtDay, fmtDayHour } from '../lib/timefmt'
import { useTacticalStore } from '../store/tacticalStore'

/** 名稱是否為「國際編號/尚未命名」(如 ELEVEN-26、TD、INVEST 91W)。 */
function isDesignation(name: string): boolean {
  return /^[A-Za-z0-9\s-]+$/.test(name) || /TD|INVEST|^\d/.test(name)
}

const VERDICT_STYLE: Record<string, string> = {
  active: 'text-rose-300',
  issue: 'text-orange-300',
  watch: 'text-amber-300',
  none: 'text-slate-400',
}

/**
 * 颱風路徑控制面板：預報員解讀 + 海巡角度的海警/陸警研判告警 + 預報摘要。
 */
export function TyphoonControls() {
  const active = useTacticalStore((s) => s.activeTyphoon)
  const own = useTacticalStore((s) => s.ownPosition)
  const tyScrubHours = useTacticalStore((s) => s.tyScrubHours)
  const setTyScrubHours = useTacticalStore((s) => s.setTyScrubHours)
  const cwa = isCwaConfigured()

  // 查詢中（尚未取得任何颱風資料）：顯示載入，不先塞示範。
  if (!active) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="animate-spin text-xl">🌀</span>
          <span className="text-sm font-semibold">查詢即時颱風資料中…</span>
        </div>
        <p className="text-[10px] text-slate-500">
          優先抓中央氣象署 (CWA) 官方；無 Taiwan 相關颱風時改用 GDACS 全球即時。
        </p>
      </div>
    )
  }

  const ty = active
  const cur = currentPoint(ty)
  const future = ty.track.filter((p) => p.hours > 0)
  const maxHours = future.reduce((m, p) => Math.max(m, p.hours), 0)
  const scrubInfo = tyScrubHours > 0 ? interpTyphoonAt(ty, tyScrubHours) : null
  const warn = estimateWarnings(ty)
  const cg = coastGuardVerdict(warn)
  // 有 GPS 定位就以「您所在位置」研判方位/距離/侵襲機率，否則以台灣中心。
  const brief = own
    ? typhoonBrief(ty, { lat: own.lat, lng: own.lng }, '您所在位置')
    : typhoonBrief(ty)
  const designation = !ty.demo && isDesignation(ty.name)

  const threatColor =
    brief.threat === 'extreme'
      ? 'border-rose-500/60 bg-rose-500/10 text-rose-200'
      : brief.threat === 'high'
        ? 'border-orange-500/50 bg-orange-500/10 text-orange-200'
        : brief.threat === 'mid'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          : 'border-slate-600 bg-slate-800/50 text-slate-300'
  const cgBanner =
    cg.top === 'active'
      ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
      : cg.top === 'issue'
        ? 'border-orange-500/60 bg-orange-500/15 text-orange-200'
        : cg.top === 'watch'
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
          : 'border-tactical-green/40 bg-tactical-green/5 text-tactical-green'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌀</span>
        <div className="flex flex-col">
          <span className="text-base font-bold text-rose-400">
            {ty.name}{' '}
            <span className="text-xs font-normal text-slate-400">
              {ty.demo ? 'DEMO' : designation ? '國際編號' : ty.nameEn}
            </span>
          </span>
          <span className="text-[11px] text-slate-400">
            {cur.cat}｜近中心風 {cur.windKt} kt｜暴風半徑 {cur.galeRadiusKm} km
          </span>
        </div>
      </div>

      {/* 預報員解讀（白話摘要）*/}
      <div className={`rounded-lg border p-2 ${threatColor}`}>
        <div className="mb-1 flex items-center gap-1 text-[11px] font-bold">
          <span>👮</span> 預報員解讀
          <span className="ml-auto text-[9px] font-normal opacity-70">
            {own ? '依您 GPS 位置' : '依台灣中心（開 📍 定位更貼身）'}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed">{brief.headline}</p>
        <p className="mt-1 text-[11px] font-semibold">👉 {brief.advice}</p>
      </div>

      {/* 海巡角度 · 警報研判告警 */}
      <div className={`rounded-lg border p-2 ${cgBanner}`}>
        <div className="mb-1 text-[11px] font-bold">🛟 海巡研判 · 本國警報告警（依路徑推估）</div>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-sky-300">🌊 海上警報</span>
            <span className={`text-right ${VERDICT_STYLE[cg.sea.level]}`}>{cg.sea.text}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-rose-300">🏝 陸上警報</span>
            <span className={`text-right ${VERDICT_STYLE[cg.land.level]}`}>{cg.land.text}</span>
          </div>
          <p className="mt-1 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold leading-relaxed">
            🚔 {cg.advice}
          </p>
          <div className="text-[9px] text-slate-500">
            暴風圈邊緣距海岸最近約 {Math.round(warn.closestGapKm)} km｜研判非官方，實際以中央氣象署發布為準
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
              <span className="text-[9px] font-semibold text-amber-300">{fmtDay(Date.now() + p.hours * 3600000)}</span>
              <span className="font-mono text-xs font-bold text-rose-300">+{p.hours}h</span>
              <span className="text-[10px] text-slate-400">{p.windKt} kt</span>
              <span className="text-[9px] text-slate-500">{p.galeRadiusKm} km</span>
            </div>
          ))}
        </div>
      )}

      {/* 時間軸拖曳：看「+N 小時」暴風圈預判位置（青色圈沿路徑移動）*/}
      {maxHours > 0 && (
        <div className="rounded-lg border border-tactical-cyan/30 bg-tactical-cyan/5 p-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-semibold text-tactical-cyan">⏱ 拖曳看暴風圈預判位置</label>
            <span className="font-mono text-[11px] text-tactical-cyan">
              {tyScrubHours === 0
                ? '現在'
                : scrubInfo
                  ? `${fmtDayHour(Date.now() + scrubInfo.hours * 3600000)} · +${Math.round(scrubInfo.hours)}h · ${scrubInfo.windKt}kt`
                  : `+${tyScrubHours}h`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxHours}
            step={1}
            value={tyScrubHours}
            onChange={(e) => setTyScrubHours(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-500">
            <span>現在</span>
            <span className="text-tactical-cyan">拖曳 → 青色圈沿路徑移動</span>
            <span>+{maxHours}h</span>
          </div>
        </div>
      )}

      {ty.demo ? (
        <p className="rounded-md bg-slate-800/60 px-2 py-1.5 text-[10px] leading-relaxed text-slate-400">
          目前查無活躍颱風，顯示<b className="text-slate-300">示範</b>。有活躍颱風時會優先用
          <b className="text-slate-300">中央氣象署 CWA 命名（中文）</b>，其次 GDACS 國際編號。
        </p>
      ) : (
        <p className="rounded-md border border-tactical-green/30 bg-tactical-green/5 px-2 py-1.5 text-[10px] leading-relaxed text-tactical-green">
          ✓ 即時資料：{cwa && !designation ? '中央氣象署 (CWA) 官方命名' : 'GDACS 全球即時'}。
          {designation && '（此系統中央氣象署尚未命名／非台灣近海，命名後會自動改用中文名）'}
        </p>
      )}
    </div>
  )
}
