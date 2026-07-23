import { useTacticalStore } from '../store/tacticalStore'
import { haversineNm, bearingDeg } from '../map/MeasureLayer'

/**
 * 量測工具：右上浮動鈕開關「點地圖量距離/方位」，開啟時顯示總距離與各段方位。
 */
export function MeasureControl() {
  const measuring = useTacticalStore((s) => s.measuring)
  const points = useTacticalStore((s) => s.measurePoints)
  const toggle = useTacticalStore((s) => s.toggleMeasure)
  const clear = useTacticalStore((s) => s.clearMeasure)
  const toolsExpanded = useTacticalStore((s) => s.toolsExpanded)

  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineNm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
  }
  const last =
    points.length >= 2
      ? bearingDeg(
          points[points.length - 2].lat,
          points[points.length - 2].lng,
          points[points.length - 1].lat,
          points[points.length - 1].lng,
        )
      : null

  return (
    <>
      {(toolsExpanded || measuring) && (
        <button
          onClick={toggle}
          className={`safe-float-top7 pointer-events-auto absolute z-[1100] flex h-11 w-11 items-center justify-center rounded-full border text-lg active:scale-95 ${
            measuring
              ? 'border-tactical-cyan bg-tactical-cyan/20 text-tactical-cyan'
              : 'border-slate-600 bg-tactical-panel/90'
          }`}
          aria-label="量測距離方位"
          title="量測距離/方位"
        >
          📏
        </button>
      )}

      {measuring && (
        <div className="safe-top pointer-events-auto absolute left-1/2 top-0 z-[1100] mt-12 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-tactical-cyan/50 bg-tactical-panel/95 px-3 py-2">
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold text-tactical-cyan">
              {points.length < 2 ? '點地圖加點量測' : `${total.toFixed(2)} 浬`}
            </span>
            <span className="text-[10px] text-slate-400">
              {points.length < 2
                ? '可連續點多段'
                : `末段方位 ${last != null ? Math.round(last) : '—'}° · ${points.length} 點`}
            </span>
          </div>
          <button
            onClick={clear}
            className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 active:scale-95"
          >
            清除
          </button>
        </div>
      )}
    </>
  )
}
