import { useTacticalStore } from '../store/tacticalStore'
import { bearingToText } from '../lib/drift'

/**
 * 搜救推演控制面板：顯示即時海象摘要 + 漂流結果，並提示操作。
 */
export function RescueControls() {
  const env = useTacticalStore((s) => s.rescueEnv)
  const drift = useTacticalStore((s) => s.driftPoints)
  const status = useTacticalStore((s) => s.rescueStatus)
  const mob = useTacticalStore((s) => s.manOverboard)
  const setMob = useTacticalStore((s) => s.setManOverboard)
  const setResult = useTacticalStore((s) => s.setRescueResult)
  const setStatus = useTacticalStore((s) => s.setStatus)

  const clear = () => {
    setMob(null)
    setResult(null, [])
    setStatus('搜救推演模式：點地圖標記落海點，計算漂流')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      {!mob && (
        <p className="text-xs leading-relaxed text-slate-300">
          🆘 <b className="text-tactical-alert">點地圖上的落海位置</b>，系統會用風場＋洋流
          預判漂流方向與搜索範圍。
        </p>
      )}

      {/* 海象摘要 */}
      {env && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="🌬 風" value={`${env.windSpeed.toFixed(1)} m/s`} sub={`來自${bearingToText(env.windDir)}`} />
          <Stat
            label="🌊 洋流"
            value={`${env.currentSpeed.toFixed(2)} m/s`}
            sub={`往${bearingToText(env.currentDir)}`}
          />
          <Stat label="〰 浪高" value={`${env.waveHeight.toFixed(1)} m`} sub={env.live ? '即時' : '離線值'} />
        </div>
      )}

      {/* 漂流結果 */}
      {status === 'loading' && <p className="text-xs text-tactical-cyan">計算漂流中…</p>}
      {status === 'done' && drift.length > 0 && (
        <div className="flex flex-col gap-1 rounded border border-rose-500/40 bg-rose-500/5 p-2">
          <div className="mb-1 text-[11px] font-semibold text-tactical-alert">漂流預判（浬）</div>
          {drift.map((p) => (
            <div key={p.hours} className="flex justify-between font-mono text-[11px] text-slate-300">
              <span className="text-tactical-alert">{p.hours}h 後</span>
              <span>
                {bearingToText(p.bearingDeg)}方 {(p.driftMeters / 1852).toFixed(1)} 浬
              </span>
              <span className="text-slate-400">半徑 {(p.radiusMeters / 1852).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {mob && (
        <button
          onClick={clear}
          className="rounded border border-slate-600 py-1.5 text-xs text-slate-300 active:scale-95"
        >
          ✕ 清除落海點，重新標記
        </button>
      )}

      {/* 圖例 */}
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span>
          <span className="text-tactical-green">▬</span> 洋流
        </span>
        <span>
          <span className="text-tactical-cyan">┄</span> 風向
        </span>
        <span>
          <span className="text-tactical-alert">◯</span> 搜索範圍
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 py-1.5">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-mono text-sm font-bold text-tactical-green">{value}</div>
      <div className="text-[9px] text-slate-500">{sub}</div>
    </div>
  )
}
