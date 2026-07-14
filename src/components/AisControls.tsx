import { useTacticalStore } from '../store/tacticalStore'
import { isAisConfigured } from '../lib/ais'
import { analyzeVessels } from '../lib/aisAnomaly'

/** AIS 模式控制面板：船舶數與異常行為警示清單。 */
export function AisControls() {
  const vessels = useTacticalStore((s) => s.vessels)
  const analyses = analyzeVessels(vessels)
  const flagged = analyses.filter((a) => a.level !== 'ok')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">📡 追蹤中船舶</span>
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

      <p className="text-[10px] leading-relaxed text-slate-500">
        點船隻可看詳情。橙框為限制水域，駛入者示警。
      </p>
      {!isAisConfigured() && (
        <p className="text-[10px] leading-relaxed text-amber-500/80">
          目前為模擬船隻。到 aisstream.io 免費申請金鑰，填入設定 ⚙️ 即接真實 AIS。
        </p>
      )}
    </div>
  )
}
