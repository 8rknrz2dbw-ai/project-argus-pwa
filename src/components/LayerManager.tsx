import { useState } from 'react'
import { useTacticalStore } from '../store/tacticalStore'
import { BASE_LABELS, type BaseLayerId } from '../lib/baseLayers'

const BASES: BaseLayerId[] = ['dark', 'nlsc', 'nlscPhoto', 'satColor']

/**
 * 統一圖層視窗（🗂️）：分類 + 打勾管理所有跨模式圖層。
 * 底圖（單選）＋ 疊加圖層（複選：警戒線 / 天氣 / 自訂點位）。
 * 取代原本散落的 🗺️ 底圖鈕與領海鈕。
 */
export function LayerManager() {
  const baseLayer = useTacticalStore((s) => s.baseLayer)
  const setBaseLayer = useTacticalStore((s) => s.setBaseLayer)
  const showTerritorial = useTacticalStore((s) => s.showTerritorial)
  const setShowTerritorial = useTacticalStore((s) => s.setShowTerritorial)
  const showWind = useTacticalStore((s) => s.showWind)
  const setShowWind = useTacticalStore((s) => s.setShowWind)
  const showWindFarms = useTacticalStore((s) => s.showWindFarms)
  const setShowWindFarms = useTacticalStore((s) => s.setShowWindFarms)
  const showMedianLine = useTacticalStore((s) => s.showMedianLine)
  const setShowMedianLine = useTacticalStore((s) => s.setShowMedianLine)
  const poiHidden = useTacticalStore((s) => s.poiHidden)
  const setPoiHidden = useTacticalStore((s) => s.setPoiHidden)
  const poiPoints = useTacticalStore((s) => s.poiPoints)
  const toolsExpanded = useTacticalStore((s) => s.toolsExpanded)
  const [open, setOpen] = useState(false)

  const anyActive = baseLayer !== 'dark' || showTerritorial || showWind || showWindFarms || showMedianLine

  return (
    <>
      {(toolsExpanded || anyActive) && (
        <button
          onClick={() => setOpen(true)}
          className={`safe-float-top8 pointer-events-auto absolute z-[1100] flex h-11 w-11 items-center justify-center rounded-full border text-lg active:scale-95 ${
            anyActive ? 'border-tactical-cyan bg-tactical-cyan/20 text-tactical-cyan' : 'border-slate-600 bg-tactical-panel/90'
          }`}
          aria-label="圖層"
          title="圖層：底圖 / 警戒線 / 風場 / 自訂點位"
        >
          🗂️
        </button>
      )}

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-3 md:items-center">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-tactical-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-tactical-cyan">🗂️ 圖層</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 active:scale-95">✕</button>
            </div>

            {/* 底圖（單選）*/}
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] font-semibold text-slate-400">🗺️ 底圖（擇一）</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BASES.map((id) => (
                  <button
                    key={id}
                    onClick={() => setBaseLayer(id)}
                    className={`rounded-lg border px-2 py-2 text-left text-[11px] font-semibold active:scale-95 ${
                      baseLayer === id
                        ? 'border-tactical-cyan bg-tactical-cyan/15 text-tactical-cyan'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    {baseLayer === id ? '● ' : '○ '}
                    {BASE_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            {/* 疊加圖層（複選）*/}
            <div className="mb-2 text-[11px] font-semibold text-slate-400">🧩 疊加圖層</div>
            <div className="flex flex-col gap-1.5">
              <LayerCheck
                label="🚧 領海基線 / 12浬 / 24浬"
                sub="領海、鄰接區參考線（判斷船隻是否進入我領海）"
                checked={showTerritorial}
                onToggle={() => setShowTerritorial(!showTerritorial)}
              />
              <LayerCheck
                label="🌀 海上風電場"
                sub="西部外海離岸風電場示意範圍＋風機（作業區/限制航行/避碰熱點）"
                checked={showWindFarms}
                onToggle={() => setShowWindFarms(!showWindFarms)}
              />
              <LayerCheck
                label="🚩 台灣海峽中線（示意）"
                sub="橫貫海峽的越界態勢監控參考線（非官方劃界）"
                checked={showMedianLine}
                onToggle={() => setShowMedianLine(!showMedianLine)}
              />
              <LayerCheck
                label="🌬️ 風向風速（海況）"
                sub="即時風向風速箭頭（Open-Meteo，免金鑰）；平移地圖自動更新"
                checked={showWind}
                onToggle={() => setShowWind(!showWind)}
              />
              <LayerCheck
                label={`🚩 自訂點位（${poiPoints.length}）`}
                sub="安檢所等自訂據點；取消勾選＝一鍵全部隱藏（旁人看不到）"
                checked={!poiHidden}
                onToggle={() => setPoiHidden(!poiHidden)}
              />
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              各模式專屬的疊層（例如 AIS 的夜間漁火/雷達暗船）仍在該模式的控制面板內開關。
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function LayerCheck({
  label,
  sub,
  checked,
  onToggle,
}: {
  label: string
  sub: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left active:scale-95 ${
        checked ? 'border-tactical-cyan/60 bg-tactical-cyan/10' : 'border-slate-700 bg-slate-900/50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
          checked ? 'border-tactical-cyan bg-tactical-cyan text-slate-900' : 'border-slate-600 text-transparent'
        }`}
      >
        ✓
      </span>
      <span className="flex flex-col">
        <span className={`text-xs font-semibold ${checked ? 'text-tactical-cyan' : 'text-slate-200'}`}>{label}</span>
        <span className="text-[10px] leading-snug text-slate-400">{sub}</span>
      </span>
    </button>
  )
}
