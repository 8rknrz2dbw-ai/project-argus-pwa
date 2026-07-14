import { useTacticalStore } from '../store/tacticalStore'
import { isEdgeAiConfigured } from '../lib/edgeAI'

/**
 * 雷達盲搜模式的控制項：框選按鈕 + AI 狀態。
 */
export function SarControls() {
  const selecting = useTacticalStore((s) => s.selecting)
  const setSelecting = useTacticalStore((s) => s.setSelecting)
  const aiStatus = useTacticalStore((s) => s.aiStatus)
  const detections = useTacticalStore((s) => s.detections)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/80 p-3">
      <button
        onClick={() => setSelecting(!selecting)}
        className={[
          'rounded-lg border px-3 py-3 text-sm font-bold transition-all active:scale-95',
          selecting
            ? 'animate-pulse-alert border-tactical-alert bg-tactical-alert/20 text-tactical-alert'
            : 'border-tactical-cyan bg-tactical-cyan/10 text-tactical-cyan',
        ].join(' ')}
      >
        {selecting ? '✋ 拖曳框選海域中…（點此取消）' : '🎯 框選海域啟動 AI 辨識'}
      </button>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">AI 狀態</span>
        <span className="font-mono">
          {aiStatus === 'idle' && <span className="text-slate-500">待命</span>}
          {aiStatus === 'loading' && <span className="text-tactical-cyan">辨識中…</span>}
          {aiStatus === 'done' && (
            <span className="text-tactical-green">完成 · {detections?.features.length ?? 0} 目標</span>
          )}
          {aiStatus === 'error' && <span className="text-tactical-alert">連線失敗</span>}
        </span>
      </div>

      {!isEdgeAiConfigured() && (
        <p className="text-[10px] leading-relaxed text-amber-500/80">
          ⚠ 未設定 VITE_EDGE_AI_URL，目前使用本機 mock 偵測。部署 Cloudflare Worker
          後填入即可接真實邊緣 AI。
        </p>
      )}
    </div>
  )
}
