import { useTacticalStore } from '../store/tacticalStore'
import { aisConfigured } from '../lib/ais'

/** AIS 模式控制面板：船舶數與可疑船隻提示。 */
export function AisControls() {
  const vessels = useTacticalStore((s) => s.vessels)
  const suspicious = vessels.filter((v) => v.name === '(無船名)' || v.type === '不明')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">📡 追蹤中船舶</span>
        <span className="font-mono text-sm font-bold text-tactical-green">{vessels.length}</span>
      </div>
      {suspicious.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">⚠ 無船名/不明</span>
          <span className="font-mono text-sm font-bold text-tactical-alert">{suspicious.length}</span>
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-slate-500">點船隻圖標可看船名、MMSI、航速航向。</p>
      {!aisConfigured && (
        <p className="text-[10px] leading-relaxed text-amber-500/80">
          目前為模擬船隻。到 aisstream.io 免費申請金鑰，填入 VITE_AISSTREAM_KEY 即接真實 AIS。
        </p>
      )}
    </div>
  )
}
